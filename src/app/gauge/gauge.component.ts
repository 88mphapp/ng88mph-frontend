// TODO
// 0- Change the addresses on the subgraph
// 1- Change veMPH address to correct address after deployment (contracts.json and constants.service.ts)
// 1- Change veMPHYieldDistributor address to correct address after deployment (contracts.json and constants.service.ts)
// 2- Change MPHGaugeController address to correct address after deployment (contracts.json)
// 2- Change MPHGaugeRewardDistributor address to correct address after deployment (contracts.json)
// 5- Disable actions if not connected to Mainnet
// 6- Ensure action flow works as expected (reloads data, etc)
// 8- User must withdraw locked MPH before creating a new lock

import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { DataService } from '../data.service';
import { WalletService } from '../wallet.service';
import { HelpersService } from '../helpers.service';
import { Timer } from '../timer';
import { Chart } from 'chart.js';
import { request, gql } from 'graphql-request';
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from 'ethereum-multicall';

@Component({
  selector: 'app-gauge',
  templateUrl: './gauge.component.html',
  styleUrls: ['./gauge.component.css'],
})
export class GaugeComponent implements OnInit {
  COLORS: string[] = [
    '107, 94, 174',
    '72, 69, 84',
    '173, 169, 187',
    '174, 73, 66',
    '234, 125, 114',
  ];

  // user
  userGauges: UserGauge[];

  mphBalance: BigNumber; // MPH balance in wallet
  mphAllowance: BigNumber; // MPH allowance for veMPH

  veBalance: BigNumber;
  veRewards: BigNumber;
  mphLocked: BigNumber;
  mphUnlocked: BigNumber;

  lockEnd: number; // timestamp when user's lock ends
  lockAmount: BigNumber; // amount of MPH to lock
  lockDuration: number; // days to lock
  maxLockDuration: number; // maximum seconds that can be locked

  selectedGauge: Gauge;
  voteWeight: BigNumber;
  votePowerUsed: BigNumber; // percent of vote power already user
  votePowerAvailable: BigNumber; // percent of vote power available to use

  loadingUser: boolean; // false when done loading

  // global
  gauges: Gauge[];

  totalMPHSupply: BigNumber;
  circulatingMPHSupply: BigNumber;
  totalMPHLocked: BigNumber;
  averageLock: BigNumber;
  veTotal: BigNumber;
  veYield: BigNumber;
  veAPR: BigNumber;

  timeLeft: number;
  timeLeftCountdown: any;

  loadingGlobal: boolean; // false when done loading

  // chart
  protocolChartLabels: string[];
  protocolChartData: {};
  userChartLabels: string[];
  userChartData: {};

  chartType = 'pie';
  chartLegend = false;
  chartOptions = {
    responsive: true,
    tooltips: {
      callbacks: {
        label: function (tooltipItem, data) {
          const index = tooltipItem.index;
          const label = data.labels[index];
          const weight = data.datasets[0].data[index].toFixed(2);
          return label + ': ' + weight + '%';
        },
      },
    },
  };

  constructor(
    public constants: ConstantsService,
    public contract: ContractService,
    public datas: DataService,
    public helpers: HelpersService,
    public wallet: WalletService,
    private modalService: NgbModal,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected || this.wallet.watching, true);

    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(false, false);
    });

    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      });
    });

    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });

    this.wallet.txConfirmedEvent.subscribe(() => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      });
    });
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.mphLocked = new BigNumber(0);
      this.mphBalance = new BigNumber(0);
      this.mphAllowance = new BigNumber(0);
      this.mphUnlocked = new BigNumber(0);
      this.veBalance = new BigNumber(0);
      this.veRewards = new BigNumber(0);
      this.lockEnd = 0;
      this.lockAmount = new BigNumber(0);
      this.lockDuration = 7;
      this.maxLockDuration = 0;

      this.userChartLabels = ['Unallocated'];
      this.userChartData = [
        {
          data: [100],
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          hoverBackgroundColor: 'rgba(255, 255, 255, 1)',
        },
      ];
      this.selectedGauge = null;
      this.voteWeight = new BigNumber(0);
      this.votePowerUsed = new BigNumber(0);
      this.votePowerAvailable = new BigNumber(0);
      this.userGauges = [];
      this.loadingUser = true;
    }

    if (resetGlobal) {
      this.veTotal = new BigNumber(0);
      this.veYield = new BigNumber(0);
      this.veAPR = new BigNumber(0);
      this.totalMPHSupply = new BigNumber(0);
      this.circulatingMPHSupply = new BigNumber(0);
      this.totalMPHLocked = new BigNumber(0);
      this.averageLock = new BigNumber(0);

      // gauge
      this.timeLeft = 0;
      this.gauges = [];

      this.protocolChartLabels = [];
      this.protocolChartData = [];

      this.loadingGlobal = true;
    }
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    // prompt network change if not connected to mainnet
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (this.wallet.networkID !== this.constants.CHAIN_ID.MAINNET) {
      this.wallet.changeChain(this.constants.CHAIN_ID.MAINNET);
      return;
    }

    const now = Math.floor(Date.now() / 1e3);
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const address = this.wallet.actualAddress.toLowerCase();
    // const address = '0x10c16c7b8b1ddcfe65990ec822de4379dd8a86de';

    const multicall = new Multicall({ web3Instance: web3, tryAggregate: true });

    const mph = this.contract.getNamedContract('MPHToken', web3);
    const vemph = this.contract.getNamedContract('veMPH', web3);
    const gaugeController = this.contract.getNamedContract(
      'MPHGaugeController',
      web3
    );
    const gaugeDistributor = this.contract.getNamedContract(
      'MPHGaugeRewardDistributor',
      web3
    );

    if (loadUser && address) {
      const userContext: ContractCallContext[] = [
        {
          reference: 'MPH',
          contractAddress: this.constants.MPH_ADDRESS[this.wallet.networkID],
          abi: require(`src/assets/abis/MPHToken.json`),
          calls: [
            {
              reference: 'User Balance',
              methodName: 'balanceOf',
              methodParameters: [address],
            },
            {
              reference: 'User Allowance',
              methodName: 'allowance',
              methodParameters: [address, vemph.options.address],
            },
          ],
        },
        {
          reference: 'veMPH',
          contractAddress: this.constants.VEMPH_ADDRESS[this.wallet.networkID],
          abi: require(`src/assets/abis/veMPH.json`),
          calls: [
            {
              reference: 'User Balance',
              methodName: 'balanceOf',
              methodParameters: [address],
            },
            {
              reference: 'User Lock',
              methodName: 'locked',
              methodParameters: [address],
            },
          ],
        },
        {
          reference: 'userRewards',
          contractAddress:
            this.constants.VEMPH_YIELD_DISTRIBUTOR[this.wallet.networkID],
          abi: require(`src/assets/abis/veMPHYieldDistributor.json`),
          calls: [
            {
              reference: 'User Rewards',
              methodName: 'earned',
              methodParameters: [address],
            },
          ],
        },
      ];

      multicall.call(userContext).then((userResults) => {
        // handle MPH results
        const mphResults = userResults.results.MPH.callsReturnContext;

        const mphBalance = new BigNumber(mphResults[0].returnValues[0].hex);
        this.mphBalance = mphBalance.div(this.constants.PRECISION);
        this.setLockAmount(this.mphBalance);

        const mphAllowance = new BigNumber(mphResults[1].returnValues[0].hex);
        this.mphAllowance = mphAllowance.div(this.constants.PRECISION);

        // handle veMPH results
        const veResults = userResults.results.veMPH.callsReturnContext;

        const veBalance = new BigNumber(veResults[0].returnValues[0].hex);
        this.veBalance = veBalance.div(this.constants.PRECISION);

        const amount = new BigNumber(veResults[1].returnValues[0].hex);
        this.lockEnd = parseInt(veResults[1].returnValues[1].hex);

        if (this.lockEnd > now) {
          this.mphLocked = amount.div(this.constants.PRECISION);
          this.maxLockDuration =
            this.constants.YEAR_IN_SEC * 4 - (this.lockEnd - now);
        } else {
          this.mphUnlocked = amount.div(this.constants.PRECISION);
          this.maxLockDuration = this.constants.YEAR_IN_SEC * 4;
        }

        // handle veReward results
        const userRewards = userResults.results.userRewards.callsReturnContext;

        const veRewards = new BigNumber(userRewards[0].returnValues[0].hex);
        this.veRewards = veRewards.div(this.constants.PRECISION);
      });

      const queryString = gql`
        {
          user(id: "${address}") {
            voteWeightUsed
            votes (
              orderBy: weight
              orderDirection: desc
            ) {
              gauge {
                address
              }
              weight
              time
            }
          }
        }
      `;
      await request(
        this.constants.GAUGES_GRAPHQL_ENDPOINT[this.wallet.networkID],
        queryString
      ).then((data: QueryResult) => this.handleData(data));

      this.loadingUser = false;
    }

    if (loadGlobal) {
      const globalContext: ContractCallContext[] = [
        {
          reference: 'MPH',
          contractAddress: this.constants.MPH_ADDRESS[this.wallet.networkID],
          abi: require(`src/assets/abis/MPHToken.json`),
          calls: [
            {
              reference: 'Total Supply',
              methodName: 'totalSupply',
              methodParameters: [],
            },
            {
              reference: 'Gov Treasury Balance',
              methodName: 'balanceOf',
              methodParameters: [
                this.constants.GOV_TREASURY[this.wallet.networkID],
              ],
            },
            {
              reference: 'Dev Wallet Balance',
              methodName: 'balanceOf',
              methodParameters: [
                this.constants.DEV_WALLET[this.wallet.networkID],
              ],
            },
            {
              reference: 'Merkle Distributor Balance',
              methodName: 'balanceOf',
              methodParameters: [
                this.constants.MERKLE_DISTRIBUTOR[this.wallet.networkID],
              ],
            },
          ],
        },
        {
          reference: 'veMPH',
          contractAddress: this.constants.VEMPH_ADDRESS[this.wallet.networkID],
          abi: require(`src/assets/abis/veMPH.json`),
          calls: [
            {
              reference: 'Total Supply',
              methodName: 'totalSupply',
              methodParameters: [],
            },
            {
              reference: 'Supply',
              methodName: 'supply',
              methodParameters: [],
            },
          ],
        },
        {
          reference: 'veYield',
          contractAddress:
            this.constants.VEMPH_YIELD_DISTRIBUTOR[this.wallet.networkID],
          abi: require(`src/assets/abis/veMPHYieldDistributor.json`),
          calls: [
            {
              reference: 'Yield For Duration',
              methodName: 'getYieldForDuration',
              methodParameters: [],
            },
            {
              reference: 'Yield Duration',
              methodName: 'yieldDuration',
              methodParameters: [],
            },
          ],
        },
      ];

      const globalResults: ContractCallResults = await multicall.call(
        globalContext
      );
      const mphResults = globalResults.results.MPH.callsReturnContext;
      const veResults = globalResults.results.veMPH.callsReturnContext;
      const veYield = globalResults.results.veYield.callsReturnContext;

      // handle MPH results
      const totalSupply = new BigNumber(mphResults[0].returnValues[0].hex);
      this.totalMPHSupply = totalSupply.div(this.constants.PRECISION);
      this.circulatingMPHSupply = totalSupply
        .minus(mphResults[1].returnValues[0].hex) // gov treasury
        .minus(mphResults[2].returnValues[0].hex) // dev wallet
        .minus(mphResults[3].returnValues[0].hex) // merkle distributor
        .div(this.constants.PRECISION);

      // handle veMPH results
      this.veTotal = new BigNumber(veResults[0].returnValues[0].hex).div(
        this.constants.PRECISION
      );
      this.totalMPHLocked = new BigNumber(veResults[1].returnValues[0].hex).div(
        this.constants.PRECISION
      );

      // handle veYield results
      this.veYield = new BigNumber(veYield[0].returnValues[0].hex).div(
        this.constants.PRECISION
      );

      const yieldDuration = new BigNumber(veYield[1].returnValues[0].hex);
      this.veAPR = this.veYield
        .div(yieldDuration)
        .times(this.constants.YEAR_IN_SEC)
        .div(this.veTotal.div(4))
        .times(100);

      // MPH * (0.75t + 1) = veMPH
      this.averageLock = this.veTotal
        .div(this.totalMPHLocked)
        .minus(1)
        .div(0.75);

      const queryString = gql`
        {
          gaugeInfo(id: "0") {
            checkpoint
            currentTotalWeight
            futureTotalWeight
          }
          gauges(orderBy: futureWeight, orderDirection: desc) {
            address
            currentWeight
            futureWeight
          }
        }
      `;
      await request(
        this.constants.GAUGES_GRAPHQL_ENDPOINT[this.wallet.networkID],
        queryString
      ).then((data: QueryResult) => this.handleData(data));

      this.loadingGlobal = false;
    }
  }

  async handleData(data: QueryResult) {
    const now = Math.floor(Date.now() / 1e3);
    const user = data.user;
    const gauges = data.gauges;

    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const gaugeController = this.contract.getNamedContract(
      'MPHGaugeController',
      web3
    );

    if (user) {
      let userGauges: UserGauge[] = [];
      let chartData: number[] = [];
      let chartLabels: string[] = [];
      let chartBackgroundColors: string[] = [];
      let chartHoverBackgroundColors: string[] = [];

      Promise.all(
        user.votes.map((vote) => {
          const gauge = vote.gauge;
          const poolInfo = this.contract.getPoolInfoFromGauge(gauge.address);

          const userGauge: UserGauge = {
            name: poolInfo ? poolInfo.name : 'Unknown',
            address: gauge.address,
            userWeight: new BigNumber(vote.weight).div(100),
            lastVote: parseInt(vote.time),
            canVote: now > parseInt(vote.time) + this.constants.DAY_IN_SEC * 10,
            explorerURL: 'https://etherscan.io/address/' + gauge.address,
          };
          userGauges = [...userGauges, userGauge];

          // update chart variables
          if (userGauge.userWeight.eq(0)) return;
          const index = (userGauges.length - 1) % this.COLORS.length;
          chartData = [...chartData, userGauge.userWeight.toNumber()];
          chartLabels = [...chartLabels, userGauge.name];
          chartBackgroundColors = [
            ...chartBackgroundColors,
            'rgba(' + this.COLORS[index] + ', 0.5)',
          ];
          chartHoverBackgroundColors = [
            ...chartHoverBackgroundColors,
            'rgba(' + this.COLORS[index] + ', 1)',
          ];
        })
      ).then(() => {
        this.votePowerUsed = new BigNumber(user.voteWeightUsed).div(100);
        this.votePowerAvailable = new BigNumber(100).minus(this.votePowerUsed);
        this.voteWeight = this.votePowerAvailable;

        // add unallocated vote weight to chart
        if (this.votePowerAvailable.gt(0)) {
          chartData = [...chartData, this.votePowerAvailable.toNumber()];
          chartLabels = [...chartLabels, 'Unallocated'];
          chartBackgroundColors = [
            ...chartBackgroundColors,
            'rgba(255, 255, 255, 0.5)',
          ];
          chartHoverBackgroundColors = [
            ...chartHoverBackgroundColors,
            'rgba(255, 255, 255, 1)',
          ];
        }

        this.userGauges = userGauges;
        this.userChartLabels = chartLabels;
        this.userChartData = [
          {
            data: chartData,
            backgroundColor: chartBackgroundColors,
            hoverBackgroundColor: chartHoverBackgroundColors,
            borderWidth: 0.5,
          },
        ];
      });
    }

    if (gauges) {
      const gaugeInfo = data.gaugeInfo;
      const totalCurrentWeight = new BigNumber(
        gaugeInfo.currentTotalWeight
      ).div(this.constants.PRECISION);
      const totalFutureWeight = new BigNumber(gaugeInfo.futureTotalWeight).div(
        this.constants.PRECISION
      );
      const globalEmissionRate = await gaugeController.methods
        .global_emission_rate()
        .call();
      const poolTVLUSD = await this.datas.loadPoolTVL(
        this.wallet.networkID,
        true
      );

      this.timeLeft = parseInt(gaugeInfo.checkpoint);
      this.timeLeftCountdown = new Timer(this.timeLeft, 'down');
      this.timeLeftCountdown.start();

      let globalGauges: Gauge[] = [];
      let chartData: number[] = [];
      let chartLabels: string[] = [];
      let chartBackgroundColors: string[] = [];
      let chartHoverBackgroundColors: string[] = [];

      Promise.all(
        gauges.map(async (gauge) => {
          const poolInfo = this.contract.getPoolInfoFromGauge(gauge.address);

          let tvlUSD = new BigNumber(0);
          if (poolInfo) {
            tvlUSD = poolTVLUSD[poolInfo.address.toLowerCase()];
          }

          const currentWeight = new BigNumber(gauge.currentWeight)
            .div(totalCurrentWeight)
            .times(100);
          const futureWeight = new BigNumber(gauge.futureWeight)
            .div(totalFutureWeight)
            .times(100);

          const currentEmissions = new BigNumber(globalEmissionRate)
            .times(currentWeight)
            .div(100);
          const futureEmissions = new BigNumber(globalEmissionRate)
            .times(futureWeight)
            .div(100);

          let currentAPR = currentEmissions
            .times(this.constants.YEAR_IN_SEC)
            .times(this.datas.mphPriceUSD)
            .div(this.constants.PRECISION)
            .div(tvlUSD)
            .times(100);
          let futureAPR = futureEmissions
            .times(this.constants.YEAR_IN_SEC)
            .times(this.datas.mphPriceUSD)
            .div(this.constants.PRECISION)
            .div(tvlUSD)
            .times(100);

          // @dev isNaN() occurs when both the numerator and denominator are 0
          currentAPR = currentAPR.isNaN() ? new BigNumber(0) : currentAPR;
          futureAPR = futureAPR.isNaN() ? new BigNumber(0) : futureAPR;

          const globalGauge: Gauge = {
            name: poolInfo ? poolInfo.name : 'Unknown',
            address: gauge.address,
            currentWeight: currentWeight,
            futureWeight: futureWeight,
            currentAPR: currentAPR,
            futureAPR: futureAPR,
            explorerURL: 'https://etherscan.io/address/' + gauge.address,
          };
          globalGauges = [...globalGauges, globalGauge];

          // update chart variables
          if (globalGauge.currentWeight.eq(0) && globalGauge.futureWeight.eq(0))
            return;
          const index = (globalGauges.length - 1) % this.COLORS.length;
          chartData = [...chartData, globalGauge.futureWeight.toNumber()];
          chartLabels = [...chartLabels, globalGauge.name];
          chartBackgroundColors = [
            ...chartBackgroundColors,
            'rgba(' + this.COLORS[index] + ', 0.5)',
          ];
          chartHoverBackgroundColors = [
            ...chartHoverBackgroundColors,
            'rgba(' + this.COLORS[index] + ', 1)',
          ];
        })
      ).then(() => {
        this.gauges = globalGauges;
        this.protocolChartLabels = chartLabels;
        this.protocolChartData = [
          {
            data: chartData,
            backgroundColor: chartBackgroundColors,
            hoverBackgroundColor: chartHoverBackgroundColors,
            borderWidth: 0.5,
          },
        ];
      });
    }
  }

  setLockAmount(amount: string | number | BigNumber): void {
    this.lockAmount = new BigNumber(amount);
    if (this.lockAmount.isNaN()) {
      this.lockAmount = new BigNumber(0);
    }
  }

  presetLockAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.lockAmount = this.mphBalance.times(ratio);
  }

  setLockDuration(duration: string | number): void {
    this.lockDuration = +duration;
    if (isNaN(this.lockDuration)) {
      this.lockDuration = 0;
    }
  }

  setVoteWeight(weight: string | number): void {
    this.voteWeight = new BigNumber(weight);
    if (this.voteWeight.isNaN()) {
      this.voteWeight = new BigNumber(0);
    }
  }

  approve(): void {
    const user = this.wallet.actualAddress;
    const mph = this.contract.getNamedContract('MPHToken');
    const lockAmount = this.helpers.processWeb3Number(
      this.lockAmount.times(this.constants.PRECISION)
    );

    this.wallet.approveToken(
      mph,
      this.constants.VEMPH_ADDRESS[this.wallet.networkID],
      lockAmount,
      () => {},
      () => {},
      async () => {
        const web3 = this.wallet.httpsWeb3();
        const mph = this.contract.getNamedContract('MPHToken', web3);
        await mph.methods
          .allowance(user, this.constants.VEMPH_ADDRESS[this.wallet.networkID])
          .call()
          .then((result) => {
            this.mphAllowance = new BigNumber(result).div(
              this.constants.PRECISION
            );
          });
      },
      (error) => {
        this.wallet.displayGenericError(error);
      },
      true
    );
  }

  createLock(): void {
    const mph = this.contract.getNamedContract('MPHToken');
    const vemph = this.contract.getNamedContract('veMPH');

    const lockAmount = this.helpers.processWeb3Number(
      this.lockAmount.times(this.constants.PRECISION)
    );
    const now = Math.floor(Date.now() / 1e3);
    const lockDuration = this.lockDuration * this.constants.DAY_IN_SEC;
    const unlockTimestamp = this.helpers.processWeb3Number(now + lockDuration);

    const func = vemph.methods.create_lock(lockAmount, unlockTimestamp);

    this.wallet.sendTxWithToken(
      func,
      mph,
      this.constants.VEMPH_ADDRESS[this.wallet.networkID],
      lockAmount,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  increaseLockAmount(): void {
    const mph = this.contract.getNamedContract('MPHToken');
    const vemph = this.contract.getNamedContract('veMPH');
    const lockAmount = this.helpers.processWeb3Number(
      this.lockAmount.times(this.constants.PRECISION)
    );
    const func = vemph.methods.increase_amount(lockAmount);

    this.wallet.sendTxWithToken(
      func,
      mph,
      this.constants.VEMPH_ADDRESS[this.wallet.networkID],
      lockAmount,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  increaseLockDuration(): void {
    const vemph = this.contract.getNamedContract('veMPH');
    const lockDuration = this.lockDuration * this.constants.DAY_IN_SEC;
    const unlockTimestamp = this.helpers.processWeb3Number(
      this.lockEnd + lockDuration
    );
    const func = vemph.methods.increase_unlock_time(unlockTimestamp);

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  vote(_gauge: string, _weight: BigNumber): void {
    const gauge = _gauge;
    const weight = this.helpers.processWeb3Number(_weight.times(100));
    const controller = this.contract.getNamedContract('MPHGaugeController');

    const func = controller.methods.vote_for_gauge_weights(gauge, weight);

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  resetVote(_gauge: string): void {
    this.vote(_gauge, new BigNumber(0));
  }

  withdraw(): void {
    const vemph = this.contract.getNamedContract('veMPH');
    const func = vemph.methods.withdraw();

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  claim(): void {
    const distributor = this.contract.getNamedContract('veMPHYieldDistributor');
    const func = distributor.methods.getYield();

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  sortGauges(event: any) {
    const column = event.active;
    if (column === 'name') {
      this.gauges =
        event.direction === 'asc'
          ? [...this.gauges.sort((a, b) => (a[column] > b[column] ? 1 : -1))]
          : [...this.gauges.sort((a, b) => (b[column] > a[column] ? 1 : -1))];
    } else {
      this.gauges =
        event.direction === 'asc'
          ? [...this.gauges.sort((a, b) => a[column].minus(b[column]))]
          : [...this.gauges.sort((a, b) => b[column].minus(a[column]))];
    }
  }

  sortUserGauges(event: any) {
    const column = event.active;
    if (column === 'name') {
      this.userGauges =
        event.direction === 'asc'
          ? [
              ...this.userGauges.sort((a, b) =>
                a[column] > b[column] ? 1 : -1
              ),
            ]
          : [
              ...this.userGauges.sort((a, b) =>
                b[column] > a[column] ? 1 : -1
              ),
            ];
    } else {
      this.userGauges =
        event.direction === 'asc'
          ? [...this.userGauges.sort((a, b) => a[column] - b[column])]
          : [...this.userGauges.sort((a, b) => b[column] - a[column])];
    }
  }

  canVote(_gauge: string): boolean {
    const gauge = this.userGauges.find(
      (gauge) => gauge.address === _gauge.toLowerCase()
    );
    return (!gauge || gauge.canVote) && this.veBalance.gt(0);
  }

  // @dev may need a separate check for expired locks
  validLockDuration(): boolean {
    if (this.veBalance.eq(0)) {
      return this.lockDuration >= 7 && this.lockDuration <= 1460;
    } else {
      return (
        this.lockDuration > 0 &&
        this.maxLockDuration >= this.lockDuration * this.constants.DAY_IN_SEC
      );
    }
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleString();
  }
}

interface Gauge {
  name: string;
  address: string;
  currentWeight: BigNumber;
  futureWeight: BigNumber;
  currentAPR: BigNumber;
  futureAPR: BigNumber;
  explorerURL: string;
}

interface UserGauge {
  name: string;
  address: string;
  userWeight: BigNumber;
  lastVote: number;
  canVote: boolean;
  explorerURL: string;
}

interface QueryResult {
  user: {
    voteWeightUsed: string;
    votes: {
      gauge: {
        address: string;
      };
      weight: string;
      time: string;
    }[];
  };
  gauges: {
    address: string;
    currentWeight: string;
    futureWeight: string;
  }[];
  gaugeInfo: {
    checkpoint: string;
    currentTotalWeight: string;
    futureTotalWeight: string;
  };
}
