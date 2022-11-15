// TODO
// 1- Disable actions if not connected to Mainnet
// 2- Ensure action flow works as expected (reloads data, etc)

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

import { BalancerService } from 'src/app/services/liquidity/balancer.service';

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

  gauges: Gauge[];
  userGauges: Gauge[];
  protocolGauges: Gauge[];

  loadingUser: boolean; // false when done loading user data
  loadingGlobal: boolean; // false when done loading global data

  bptBalance: BigNumber; // user's balance of BPT
  bptAllowance: BigNumber; // user's BPT allowance for voting escrow
  veBalance: BigNumber; // user's voting power
  bptLocked: BigNumber; // BPT amount locked
  bptUnlocked: BigNumber; // BPT amount unlocked
  mphRewards: BigNumber; // mph rewards that can be claimed by the user
  balRewards: BigNumber; // bal rewards that can be claimed by the user

  now: number; // current timestamp in seconds
  lockEnd: number; // timestamp when user's lock ends
  lockAmount: BigNumber; // amount of MPH to lock
  lockDuration: number; // days to lock
  maxLockDuration: number; // maximum seconds that can be locked

  selectedGauge: Gauge;
  voteWeight: BigNumber;
  votePowerUsed: BigNumber; // percent of vote power already user
  votePowerAvailable: BigNumber; // percent of vote power available to use

  totalMPHSupply: BigNumber;
  circulatingMPHSupply: BigNumber;
  totalMPHLocked: BigNumber;
  averageLock: BigNumber; // average length of lock in years
  veTotal: BigNumber;
  veYield: BigNumber;

  bptAPR: BigNumber; // swap fee APR for veMPH holders
  mphAPR: BigNumber; // MPH reward APR for veMPH holders
  balAPR: BigNumber; // BAL reward APR for veMPH holders
  veAPR: BigNumber; // bptAPR + mphAPR + balAPR for veMPH holders

  timeLeft: number;
  timeLeftCountdown: any;
  rewardPeriodEnd: number;
  rewardPeriodCountdown: any;

  // chart
  protocolChartData: {};
  protocolChartLabels: string[];

  userChartData: {};
  userChartLabels: string[];

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
    public balancer: BalancerService,
    public constants: ConstantsService,
    public contract: ContractService,
    public datas: DataService,
    public helpers: HelpersService,
    public wallet: WalletService,
    private modalService: NgbModal,
    private zone: NgZone
  ) {
    this.resetData(true, true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected || this.wallet.watching, true, true);

    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false, false);
      this.loadData(true, false, false);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false, false);
      this.loadData(false, false, false);
    });

    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true, true);
        this.loadData(true, true, true);
      });
    });

    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false, false);
        this.loadData(true, false, false);
      });
    });

    this.wallet.txConfirmedEvent.subscribe(() => {
      this.zone.run(() => {
        this.resetData(true, true, false);
        this.loadData(true, true, false);
      });
    });
  }

  resetData(
    resetUser: boolean,
    resetGlobal: boolean,
    resetGauges: boolean
  ): void {
    if (resetUser) {
      this.userGauges = [];
      this.loadingUser = true;

      this.bptLocked = new BigNumber(0);
      this.bptBalance = new BigNumber(0);
      this.bptAllowance = new BigNumber(0);
      this.bptUnlocked = new BigNumber(0);
      this.veBalance = new BigNumber(0);
      this.mphRewards = new BigNumber(0);
      this.balRewards = new BigNumber(0);
      this.lockEnd = 0;
      this.lockAmount = new BigNumber(0);
      this.lockDuration = 7;
      this.maxLockDuration = 0;

      this.selectedGauge = null;
      this.voteWeight = new BigNumber(0);
      this.votePowerUsed = new BigNumber(0);
      this.votePowerAvailable = new BigNumber(0);

      this.userChartData = [];
      this.userChartLabels = [];
    }

    if (resetGlobal) {
      this.protocolGauges = [];
      this.loadingGlobal = true;

      this.veTotal = new BigNumber(0);
      this.veYield = new BigNumber(0);
      this.bptAPR = new BigNumber(0);
      this.mphAPR = new BigNumber(0);
      this.balAPR = new BigNumber(0);
      this.veAPR = new BigNumber(0);
      this.totalMPHSupply = new BigNumber(0);
      this.circulatingMPHSupply = new BigNumber(0);
      this.totalMPHLocked = new BigNumber(0);
      this.averageLock = new BigNumber(0);

      // gauge
      this.timeLeft = 0;
      this.rewardPeriodEnd = 0;

      this.protocolChartData = [];
      this.protocolChartLabels = [];
    }

    if (resetGauges) {
      this.gauges = [];
    }
  }

  // ----------------------------------------------------------------------
  // @dev loadGauges() may not finish loading before loadUser() is called
  // resulting in user data not being loaded. So, we call loadGauges() if
  // this.gauges hasn't been populated. This will cause 2 subgraph queries,
  // which is suboptimal.
  // ----------------------------------------------------------------------
  async loadData(loadUser: boolean, loadGlobal: boolean, loadGauges: boolean) {
    // prompt network change if not connected to mainnet
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (this.wallet.networkID !== this.constants.CHAIN_ID.MAINNET) {
      this.wallet.changeChain(this.constants.CHAIN_ID.MAINNET);
      return;
    }

    this.now = Math.floor(Date.now() / 1e3);
    const user = this.wallet.actualAddress;

    if (loadGauges || this.gauges.length == 0) await this.loadGauges();
    if (loadUser) this.loadUser(this.gauges, user);
    if (loadGlobal) this.loadGlobal(this.gauges);
  }

  async loadGauges() {
    const queryString = gql`
      {
        gauges(first: 1000) {
          address
        }
      }
    `;
    await request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => {
      let gauges: Gauge[] = [];

      data.gauges.map((gauge) => {
        const poolInfo = this.contract.getPoolInfoFromGauge(gauge.address);
        if (poolInfo.protocol === 'Harvest') return;

        const gaugeObj: Gauge = {
          name: poolInfo ? poolInfo.name : 'Unknown',
          pool: poolInfo.address.toLowerCase(),
          address: gauge.address,
          explorerURL: 'https://etherscan.io/address/' + gauge.address,

          gaugeAprThisPeriod: new BigNumber(0),
          gaugeAprNextPeriod: new BigNumber(0),
          gaugeWeightThisPeriod: new BigNumber(0),
          gaugeWeightNextPeriod: new BigNumber(0),

          userWeight: new BigNumber(0),
          userLastVote: new BigNumber(0),
          userCanVote: false,
        };
        gauges = [...gauges, gaugeObj];
      });

      this.gauges = gauges;
    });
  }

  loadUser(gauges: Gauge[], userAddress: string) {
    Promise.all([
      this.callUserData(userAddress),
      this.callUserGaugeVotes(gauges, userAddress),
      this.callUserGaugeVoteTime(gauges, userAddress),
    ]).then(() => {
      const userGauges = [...gauges];
      userGauges.sort((a, b) => (a.userWeight.gt(b.userWeight) ? -1 : 1));
      this.fillUserChart(userGauges);
      this.userGauges = userGauges;
      this.loadingUser = false;
    });
  }

  loadGlobal(gauges: Gauge[]) {
    // start next priod voting countdown
    const week_in_ms = this.constants.WEEK_IN_SEC * 1000;
    const next_week_timestamp =
      (Math.floor((Date.now() + week_in_ms) / week_in_ms) * week_in_ms) / 1000;
    this.timeLeft = next_week_timestamp;
    this.timeLeftCountdown = new Timer(next_week_timestamp, 'down');
    this.timeLeftCountdown.start();

    Promise.all([
      this.callGlobalData(),
      this.callGaugeWeightThisPeriod(gauges),
      this.callGaugeWeightNextPeriod(gauges),
    ]).then(async () => {
      await this.calcGaugeApr(gauges);
      const protocolGauges = [...gauges];
      protocolGauges.sort((a, b) =>
        a.gaugeWeightNextPeriod.gt(b.gaugeWeightNextPeriod) ? -1 : 1
      );
      this.fillProtocolChart(protocolGauges);
      this.protocolGauges = protocolGauges;
      this.loadingGlobal = false;
    });
  }

  async callGlobalData() {
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const multicall = new Multicall({ web3Instance: web3, tryAggregate: true });
    const epochTimestamp = this.getPreviousEpoch(1);

    const globalContext: ContractCallContext[] = [
      {
        reference: 'BALMPH',
        contractAddress: this.constants.BALMPH_ADDRESS[this.wallet.networkID],
        abi: require(`src/assets/abis/balMPH.json`),
        calls: [
          {
            reference: 'Total Supply',
            methodName: 'totalSupply',
            methodParameters: [],
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
        contractAddress: this.constants.FEE_DISTRIBUTOR[this.wallet.networkID],
        abi: require(`src/assets/abis/FeeDistributor.json`),
        calls: [
          {
            reference: 'MPH Rewards',
            methodName: 'getTokensDistributedInWeek',
            methodParameters: [
              this.constants.MPH_ADDRESS[this.wallet.networkID],
              epochTimestamp,
            ],
          },
          {
            reference: 'BAL Rewards',
            methodName: 'getTokensDistributedInWeek',
            methodParameters: [
              this.constants.BAL[this.wallet.networkID],
              epochTimestamp,
            ],
          },
          {
            reference: 'Period End',
            methodName: 'getTimeCursor',
            methodParameters: [],
          },
        ],
      },
    ];

    const globalResults: ContractCallResults = await multicall.call(
      globalContext
    );
    const balMPHResults = globalResults.results.BALMPH.callsReturnContext;
    const veResults = globalResults.results.veMPH.callsReturnContext;
    const veYield = globalResults.results.veYield.callsReturnContext;

    // handle balMPH results
    const totalSupply = new BigNumber(balMPHResults[0].returnValues[0].hex);
    this.totalMPHSupply = totalSupply.div(this.constants.PRECISION);

    // handle veMPH results
    // @dev link to Balancer's implementation of APR calculations
    // https://github.com/balancer-labs/frontend-v2/blob/9fd0bffa46de132cd8ee18a66664fc9a2b8ef2f5/src/services/pool/concerns/apr/apr.concern.ts
    this.veTotal = new BigNumber(veResults[0].returnValues[0].hex).div(
      this.constants.PRECISION
    );
    this.totalMPHLocked = new BigNumber(veResults[1].returnValues[0].hex).div(
      this.constants.PRECISION
    );

    // handle veYield results
    const mphPriceUSD = this.datas.mphPriceUSD;
    const balPriceUSD = await this.datas.getAssetPriceUSD(
      this.constants.BAL[this.wallet.networkID],
      this.wallet.networkID
    );
    const bptPriceUSD = await this.balancer.calcBptPrice();

    const mphRewardUSD = new BigNumber(veYield[0].returnValues[0].hex)
      .div(this.constants.PRECISION)
      .times(mphPriceUSD);
    const balRewardUSD = new BigNumber(veYield[1].returnValues[0].hex)
      .div(this.constants.PRECISION)
      .times(balPriceUSD);

    this.bptAPR = await this.balancer.calcSwapFeeApr();
    if (this.bptAPR.isNaN()) {
      this.bptAPR = new BigNumber(0);
    }

    this.mphAPR = mphRewardUSD
      .times(52)
      .div(bptPriceUSD.times(this.veTotal))
      .times(100);
    if (this.mphAPR.isNaN()) {
      this.mphAPR = new BigNumber(0);
    }

    this.balAPR = balRewardUSD
      .times(52)
      .div(bptPriceUSD.times(this.veTotal))
      .times(100);
    if (this.balAPR.isNaN()) {
      this.balAPR = new BigNumber(0);
    }

    this.veAPR = this.bptAPR.plus(this.mphAPR).plus(this.balAPR);
    this.veYield = mphRewardUSD.plus(balRewardUSD).times(52).div(this.veTotal);
    if (this.veYield.isNaN()) {
      this.veYield = new BigNumber(0);
    }

    this.rewardPeriodEnd = new BigNumber(
      veYield[2].returnValues[0].hex
    ).toNumber();
    this.rewardPeriodCountdown = new Timer(this.rewardPeriodEnd, 'down');
    this.rewardPeriodCountdown.start();

    // BPT * 0.25t = veMPH
    this.averageLock = this.veTotal.div(this.totalMPHLocked).div(0.25);
    if (this.averageLock.isNaN()) {
      this.averageLock = new BigNumber(0);
    }
  }

  // ----------------------------------------------------------------------
  // @notice Fetches relative gauge weights for the current period (current).
  // ----------------------------------------------------------------------
  async callGaugeWeightThisPeriod(gauges: Gauge[]) {
    if (gauges.length == 0) return;

    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const multicall = new Multicall({ web3Instance: web3, tryAggregate: true });

    const week_in_ms = this.constants.WEEK_IN_SEC * 1000;
    const this_week_timestamp =
      (Math.floor(Date.now() / week_in_ms) * week_in_ms) / 1000;

    const calls = gauges.map((gauge) => {
      return {
        reference: `${gauge.address}`,
        methodName: 'gauge_relative_weight_write',
        methodParameters: [gauge.address, this_week_timestamp],
      };
    });

    const contractCallContext: ContractCallContext[] = [
      {
        reference: 'gauge_relative_weight_this_period',
        contractAddress: this.constants.GAUGE_CONTROLLER,
        abi: require('src/assets/abis/MPHGaugeController.json'),
        calls: calls,
      },
    ];
    const contractCallResults: ContractCallResults = await multicall.call(
      contractCallContext
    );
    const results =
      contractCallResults.results.gauge_relative_weight_this_period
        .callsReturnContext;
    results.forEach((result) => {
      const gauge = gauges.find((gauge) => gauge.address === result.reference);
      const gauge_weight = new BigNumber(result.returnValues[0].hex);
      gauge.gaugeWeightThisPeriod = gauge_weight.div(1e18).times(100);
    });
  }

  // ----------------------------------------------------------------------
  // @notice Fetches relative gauge weights for the upcoming period (future).
  // ----------------------------------------------------------------------
  async callGaugeWeightNextPeriod(gauges: Gauge[]) {
    if (gauges.length == 0) return;

    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const multicall = new Multicall({ web3Instance: web3, tryAggregate: true });

    const week_in_ms = this.constants.WEEK_IN_SEC * 1000;
    const next_week_timestamp =
      (Math.floor((Date.now() + week_in_ms) / week_in_ms) * week_in_ms) / 1000;

    const calls = gauges.map((gauge) => {
      return {
        reference: `${gauge.address}`,
        methodName: 'gauge_relative_weight_write',
        methodParameters: [gauge.address, next_week_timestamp],
      };
    });

    const contractCallContext: ContractCallContext[] = [
      {
        reference: 'gauge_relative_weight_next_period',
        contractAddress: this.constants.GAUGE_CONTROLLER,
        abi: require('src/assets/abis/MPHGaugeController.json'),
        calls: calls,
      },
    ];
    const contractCallResults: ContractCallResults = await multicall.call(
      contractCallContext
    );

    const results =
      contractCallResults.results.gauge_relative_weight_next_period
        .callsReturnContext;
    results.forEach((result) => {
      const gauge = gauges.find((gauge) => gauge.address === result.reference);
      const gauge_weight = new BigNumber(result.returnValues[0].hex);
      gauge.gaugeWeightNextPeriod = gauge_weight.div(1e18).times(100);
    });
  }

  // ----------------------------------------------------------------------
  // ----------------------------------------------------------------------
  async callUserData(userAddress: string) {
    if (userAddress) {
      const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
      const multicall = new Multicall({
        web3Instance: web3,
        tryAggregate: true,
      });

      const userContext: ContractCallContext[] = [
        {
          reference: 'balMPH',
          contractAddress: this.constants.BALMPH_ADDRESS[this.wallet.networkID],
          abi: require(`src/assets/abis/balMPH.json`),
          calls: [
            {
              reference: 'User Balance',
              methodName: 'balanceOf',
              methodParameters: [userAddress],
            },
            {
              reference: 'User Allowance',
              methodName: 'allowance',
              methodParameters: [
                userAddress,
                this.constants.VEMPH_ADDRESS[this.wallet.networkID],
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
              reference: 'User Balance',
              methodName: 'balanceOf',
              methodParameters: [userAddress],
            },
            {
              reference: 'User Lock',
              methodName: 'locked',
              methodParameters: [userAddress],
            },
          ],
        },
        {
          reference: 'userRewards',
          contractAddress:
            this.constants.FEE_DISTRIBUTOR[this.wallet.networkID],
          abi: require(`src/assets/abis/FeeDistributor.json`),
          calls: [
            {
              reference: 'MPH Rewards',
              methodName: 'claimToken',
              methodParameters: [
                userAddress,
                this.constants.MPH_ADDRESS[this.wallet.networkID],
              ],
            },
            {
              reference: 'BAL Rewards',
              methodName: 'claimToken',
              methodParameters: [
                userAddress,
                this.constants.BAL[this.wallet.networkID],
              ],
            },
          ],
        },
      ];

      const userResults: ContractCallResults = await multicall.call(
        userContext
      );

      // handle MPH results
      const balResults = userResults.results.balMPH.callsReturnContext;

      const bptBalance = new BigNumber(balResults[0].returnValues[0].hex);
      this.bptBalance = bptBalance.div(this.constants.PRECISION);
      this.setLockAmount(this.bptBalance);

      const bptAllowance = new BigNumber(balResults[1].returnValues[0].hex);
      this.bptAllowance = bptAllowance.div(this.constants.PRECISION);

      // handle veMPH results
      const veResults = userResults.results.veMPH.callsReturnContext;

      const veBalance = new BigNumber(veResults[0].returnValues[0].hex);
      this.veBalance = veBalance.div(this.constants.PRECISION);

      const amount = new BigNumber(veResults[1].returnValues[0].hex);
      this.lockEnd = parseInt(veResults[1].returnValues[1].hex);
      // this.now = now;

      if (this.lockEnd > this.now) {
        this.bptLocked = amount.div(this.constants.PRECISION);
        this.maxLockDuration =
          this.constants.YEAR_IN_SEC * 4 - (this.lockEnd - this.now);
      } else {
        this.bptUnlocked = amount.div(this.constants.PRECISION);
        this.maxLockDuration = this.constants.YEAR_IN_SEC * 4;
      }

      const userRewards = userResults.results.userRewards.callsReturnContext;

      let mphRewards = new BigNumber(0);
      if (userRewards[0].returnValues[0]) {
        mphRewards = new BigNumber(userRewards[0].returnValues[0].hex);
      }
      this.mphRewards = mphRewards.div(this.constants.PRECISION);

      let balRewards = new BigNumber(0);
      if (userRewards[1].returnValues[0]) {
        mphRewards = new BigNumber(userRewards[1].returnValues[0].hex);
      }
      this.balRewards = balRewards.div(this.constants.PRECISION);
    }
  }

  // ----------------------------------------------------------------------
  // @notice Fetches the user's vote weight for each gauge.
  // ----------------------------------------------------------------------
  async callUserGaugeVotes(gauges: Gauge[], userAddress: string) {
    if (gauges.length == 0) return;

    if (userAddress) {
      const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
      const multicall = new Multicall({
        web3Instance: web3,
        tryAggregate: true,
      });

      const calls = gauges.map((gauge) => {
        return {
          reference: `${gauge.address}`,
          methodName: 'vote_user_slopes',
          methodParameters: [userAddress, gauge.address],
        };
      });

      const contractCallContext: ContractCallContext[] = [
        {
          reference: 'vote_user_slopes',
          contractAddress: this.constants.GAUGE_CONTROLLER,
          abi: require('src/assets/abis/MPHGaugeController.json'),
          calls: calls,
        },
      ];
      const contractCallResults: ContractCallResults = await multicall.call(
        contractCallContext
      );

      let votePowerUsed = new BigNumber(0);
      const results =
        contractCallResults.results.vote_user_slopes.callsReturnContext;

      results.forEach((result) => {
        const gauge = gauges.find(
          (gauge) => gauge.address === result.reference
        );
        const user_weight = new BigNumber(result.returnValues[1].hex);
        votePowerUsed = votePowerUsed.plus(user_weight.div(100));
        gauge.userWeight = user_weight.div(100);
      });

      this.votePowerUsed = votePowerUsed;
      this.votePowerAvailable = new BigNumber(100).minus(votePowerUsed);
      this.voteWeight = new BigNumber(100).minus(votePowerUsed);
    }
  }

  // ----------------------------------------------------------------------
  // @notice Fetches the user's last vote timestamp (seconds) for each gauge.
  // ----------------------------------------------------------------------
  async callUserGaugeVoteTime(gauges: Gauge[], userAddress: string) {
    if (gauges.length == 0) return;

    if (userAddress) {
      const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
      const multicall = new Multicall({
        web3Instance: web3,
        tryAggregate: true,
      });
      const calls = gauges.map((gauge) => {
        return {
          reference: `${gauge.address}`,
          methodName: 'last_user_vote',
          methodParameters: [userAddress, gauge.address],
        };
      });

      const contractCallContext: ContractCallContext[] = [
        {
          reference: 'last_user_vote',
          contractAddress: this.constants.GAUGE_CONTROLLER,
          abi: require('src/assets/abis/MPHGaugeController.json'),
          calls: calls,
        },
      ];
      const contractCallResults: ContractCallResults = await multicall.call(
        contractCallContext
      );

      const results =
        contractCallResults.results.last_user_vote.callsReturnContext;
      results.forEach((result) => {
        const gauge = gauges.find(
          (gauge) => gauge.address === result.reference
        );
        const user_last_vote = new BigNumber(result.returnValues[0].hex);
        gauge.userLastVote = user_last_vote;
        gauge.userCanVote = user_last_vote
          .plus(this.constants.DAY_IN_SEC * 10)
          .lte(this.now);
      });
    }
  }

  async calcGaugeApr(gauges: Gauge[]) {
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const rewardDistributor = this.contract.getNamedContract(
      'GaugeRewardDistributor',
      web3
    );
    const globalEmissionRate = await rewardDistributor.methods
      .global_emission_rate()
      .call();

    const mphPriceUSD = this.datas.mphPriceUSD;
    const poolTVLUSD = await this.datas.loadPoolTVL(
      this.wallet.networkID,
      true
    );

    gauges.forEach((gauge) => {
      const gauge_weight_this_period = gauge.gaugeWeightThisPeriod;
      const reward_this_period = gauge_weight_this_period
        .times(globalEmissionRate)
        .times(this.constants.WEEK_IN_SEC)
        .div(this.constants.PRECISION)
        .div(100)
        .times(mphPriceUSD);
      gauge.gaugeAprThisPeriod = reward_this_period
        .times(52)
        .div(poolTVLUSD[gauge.pool])
        .times(100);
      if (gauge.gaugeAprThisPeriod.isNaN()) {
        gauge.gaugeAprThisPeriod = new BigNumber(0);
      }

      const gauge_weight_next_period = gauge.gaugeWeightNextPeriod;
      const reward_next_period = gauge_weight_next_period
        .times(globalEmissionRate)
        .times(this.constants.WEEK_IN_SEC)
        .div(this.constants.PRECISION)
        .div(100)
        .times(mphPriceUSD);

      gauge.gaugeAprNextPeriod = reward_next_period
        .times(52)
        .div(poolTVLUSD[gauge.pool])
        .times(100);
      if (gauge.gaugeAprNextPeriod.isNaN()) {
        gauge.gaugeAprNextPeriod = new BigNumber(0);
      }
    });
  }

  fillProtocolChart(gauges: Gauge[]) {
    let index = 0;

    let chartData: number[] = [];
    let chartLabels: string[] = [];
    let chartBackgroundColors: string[] = [];
    let chartHoverBackgroundColors: string[] = [];

    // fill gauge weight for each gauge
    gauges.forEach((gauge) => {
      if (gauge.gaugeWeightNextPeriod.gt(0)) {
        chartData = [...chartData, gauge.gaugeWeightNextPeriod.toNumber()];
        chartLabels = [...chartLabels, gauge.name];
        chartBackgroundColors = [
          ...chartBackgroundColors,
          'rgba(' + this.COLORS[index % this.COLORS.length] + ', 0.5)',
        ];
        chartHoverBackgroundColors = [
          ...chartHoverBackgroundColors,
          'rgba(' + this.COLORS[index % this.COLORS.length] + ', 1)',
        ];
        index += 1;
      }
    });

    this.protocolChartLabels = chartLabels;
    this.protocolChartData = [
      {
        data: chartData,
        backgroundColor: chartBackgroundColors,
        hoverBackgroundColor: chartHoverBackgroundColors,
        borderWidth: 0.5,
      },
    ];
  }

  fillUserChart(gauges: Gauge[]) {
    let index = 0;

    let chartData: number[] = [];
    let chartLabels: string[] = [];
    let chartBackgroundColors: string[] = [];
    let chartHoverBackgroundColors: string[] = [];

    // fill user weight for each gauge
    gauges.forEach((gauge) => {
      if (gauge.userWeight.gt(0)) {
        chartData = [...chartData, gauge.userWeight.toNumber()];
        chartLabels = [...chartLabels, gauge.name];
        chartBackgroundColors = [
          ...chartBackgroundColors,
          'rgba(' + this.COLORS[index % this.COLORS.length] + ', 0.5)',
        ];
        chartHoverBackgroundColors = [
          ...chartHoverBackgroundColors,
          'rgba(' + this.COLORS[index % this.COLORS.length] + ', 1)',
        ];
        index += 1;
      }
    });

    // fill unallocated user weight
    if (this.veBalance.gt(0) && this.votePowerAvailable.gt(0)) {
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

    this.userChartLabels = chartLabels;
    this.userChartData = [
      {
        data: chartData,
        backgroundColor: chartBackgroundColors,
        hoverBackgroundColor: chartHoverBackgroundColors,
        borderWidth: 0.5,
      },
    ];
  }

  setLockAmount(amount: string | number | BigNumber): void {
    this.lockAmount = new BigNumber(amount);
    if (this.lockAmount.isNaN()) {
      this.lockAmount = new BigNumber(0);
    }
  }

  presetLockAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.lockAmount = this.bptBalance.times(ratio);
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
    const balMPH = this.contract.getNamedContract('balMPH');
    const lockAmount = this.helpers.processWeb3Number(
      this.lockAmount.times(this.constants.PRECISION)
    );

    this.wallet.approveToken(
      balMPH,
      this.constants.VEMPH_ADDRESS[this.wallet.networkID],
      lockAmount,
      () => {},
      () => {},
      async () => {
        const web3 = this.wallet.httpsWeb3();
        const balMPH = this.contract.getNamedContract('balMPH', web3);
        await balMPH.methods
          .allowance(user, this.constants.VEMPH_ADDRESS[this.wallet.networkID])
          .call()
          .then((result) => {
            this.bptAllowance = new BigNumber(result).div(
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
    const balmph = this.contract.getNamedContract('balMPH');
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
      balmph,
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
    const balmph = this.contract.getNamedContract('balMPH');
    const vemph = this.contract.getNamedContract('veMPH');
    const lockAmount = this.helpers.processWeb3Number(
      this.lockAmount.times(this.constants.PRECISION)
    );
    const func = vemph.methods.increase_amount(lockAmount);

    this.wallet.sendTxWithToken(
      func,
      balmph,
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

  claim(token: string): void {
    const distributor = this.contract.getNamedContract('FeeDistributor');
    const func = distributor.methods.claimToken(
      this.wallet.actualAddress,
      token
    );

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {}, // @todo update token balance
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  claimAll(): void {
    const distributor = this.contract.getNamedContract('FeeDistributor');
    const func = distributor.methods.claimTokens(this.wallet.actualAddress, [
      this.constants.MPH_ADDRESS[this.wallet.networkID],
      this.constants.BAL[this.wallet.networkID],
    ]);

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {}, // @todo update token balance
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  sortGauges(event: any) {
    const column = event.active;
    if (column === 'name') {
      this.protocolGauges =
        event.direction === 'asc'
          ? [
              ...this.protocolGauges.sort((a, b) =>
                a[column] > b[column] ? 1 : -1
              ),
            ]
          : [
              ...this.protocolGauges.sort((a, b) =>
                b[column] > a[column] ? 1 : -1
              ),
            ];
    } else {
      this.protocolGauges =
        event.direction === 'asc'
          ? [...this.protocolGauges.sort((a, b) => a[column].minus(b[column]))]
          : [...this.protocolGauges.sort((a, b) => b[column].minus(a[column]))];
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
          ? [...this.userGauges.sort((a, b) => a[column].minus(b[column]))]
          : [...this.userGauges.sort((a, b) => b[column].minus(a[column]))];
    }
  }

  canVote(_gauge: string): boolean {
    const gauge = this.userGauges.find(
      (gauge) => gauge.address === _gauge.toLowerCase()
    );
    return (!gauge || gauge.userCanVote) && this.veBalance.gt(0);
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

  getPreviousEpoch(weeksToGoBack: number = 0): number {
    const now = new Date();
    const todayAtMidnightUTC =
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1e3;

    let daysSinceThursday = now.getDay() - 4;
    if (daysSinceThursday < 0) daysSinceThursday += 7;
    daysSinceThursday = daysSinceThursday + weeksToGoBack * 7;

    let secondsSinceThursday = daysSinceThursday * this.constants.DAY_IN_SEC;
    return todayAtMidnightUTC - secondsSinceThursday;
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  }
}

interface Gauge {
  name: string;
  pool: string;
  address: string;
  explorerURL: string;

  gaugeAprThisPeriod: BigNumber;
  gaugeAprNextPeriod: BigNumber;
  gaugeWeightThisPeriod: BigNumber;
  gaugeWeightNextPeriod: BigNumber;

  userWeight: BigNumber;
  userLastVote: BigNumber;
  userCanVote: boolean;
}

interface QueryResult {
  gauges: {
    address: string;
  }[];
}
