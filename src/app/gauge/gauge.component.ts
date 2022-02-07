// TODO
// 1- Change veMPH address to correct address after deployment (contracts.json and constants.service.ts)
// 2- Change MPHGaugeController address to correct address after deployment (contracts.json)
// 2- Change MPHGaugeRewardDistributor address to correct address after deployment (contracts.json)
// 3- Add checks for extending lock duration (e.g. can't add 4 years to an existing 3 year lock)
// 4- Prompt network switch if not connected to Mainnet
// 5- Disable actions if not connected to Mainnet
// 6- Ensure action flow works as expected (reloads data, etc)
// 7- Check if user is able to vote for gauge (10 day waiting period)
// 8- User must withdraw locked MPH before creating a new lock

import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ModalUnstakeComponent } from './modal-unstake/modal-unstake.component';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { DataService } from '../data.service';
import { WalletService } from '../wallet.service';
import { HelpersService } from '../helpers.service';
import { Timer } from '../timer';
import { Chart } from 'chart.js';

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
  mphLocked: BigNumber;
  mphUnlocked: BigNumber;

  lockEnd: number; // timestamp when user's lock ends
  lockAmount: BigNumber; // amount of MPH to lock
  lockDuration: number; // days to lock
  maxLockDuration: number; // maximum seconds that can be locked

  selectedGauge: Gauge;
  voteWeight: BigNumber;
  votePowerUsed: BigNumber;

  loadingUser: boolean; // false when done loading

  // global
  gauges: Gauge[];

  totalMPHSupply: BigNumber;
  circulatingMPHSupply: BigNumber;
  totalMPHLocked: BigNumber;
  averageLock: BigNumber;
  veTotal: BigNumber;

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

    // this.wallet.chainChangedEvent.subscribe((networkID) => {
    //   this.zone.run(() => {
    //     this.resetData(true, true);
    //     this.loadData(true, true);
    //   });
    // });

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
      this.lockEnd = 0;
      this.lockAmount = new BigNumber(0);
      this.lockDuration = 7;
      this.maxLockDuration = 0;

      this.userChartLabels = [];
      this.userChartData = [];
      this.selectedGauge = null;
      this.voteWeight = new BigNumber(0);
      this.votePowerUsed = new BigNumber(0);
      this.userGauges = [];
      this.loadingUser = true;
    }

    if (resetGlobal) {
      this.veTotal = new BigNumber(0);
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
    const now = Math.floor(Date.now() / 1e3);
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const address = this.wallet.actualAddress.toLowerCase();
    // const address = '0x10c16c7B8b1DDCFE65990ec822DE4379dd8a86dE';

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
      if (mph.options.address) {
        mph.methods
          .balanceOf(address)
          .call()
          .then((balance) => {
            this.mphBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
            this.setLockAmount(this.mphBalance);
          });

        mph.methods
          .allowance(address, vemph.options.address)
          .call()
          .then((result) => {
            this.mphAllowance = new BigNumber(result).div(
              this.constants.PRECISION
            );
          });
      }

      if (vemph.options.address) {
        vemph.methods
          .balanceOf(address)
          .call()
          .then((balance) => {
            this.veBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });

        // load user's current lock
        // @dev needs to be checked against expired lock
        await vemph.methods
          .locked(address)
          .call()
          .then((result) => {
            const amount = new BigNumber(result.amount).div(
              this.constants.PRECISION
            );
            this.lockEnd = parseInt(result.end);

            if (this.lockEnd > now) {
              this.mphLocked = amount;
              this.maxLockDuration =
                this.constants.YEAR_IN_SEC * 4 - (this.lockEnd - now);
            } else {
              this.mphUnlocked = amount;
              this.maxLockDuration = this.constants.YEAR_IN_SEC * 4;
            }
          });
      }

      // load user's gauges (includes those without a vote weight)
      let userGauges: UserGauge[] = [];
      const numGauges = await gaugeController.methods.n_gauges().call();

      for (let i = 0; i < +numGauges; i++) {
        const gaugeAddress = await gaugeController.methods.gauges(i).call();
        const poolInfo = this.contract.getPoolInfoFromGauge(gaugeAddress);

        let voteWeight: BigNumber;
        await gaugeController.methods
          .vote_user_slopes(address, gaugeAddress)
          .call()
          .then((result) => {
            voteWeight = new BigNumber(result.power).div(100);
          });

        let lastVote: number;
        await gaugeController.methods
          .last_user_vote(address, gaugeAddress)
          .call()
          .then((result) => {
            lastVote = parseInt(result);
          });

        const canVote = now > lastVote + this.constants.DAY_IN_SEC * 10;

        const userGauge: UserGauge = {
          name: poolInfo.name,
          address: gaugeAddress,
          userWeight: voteWeight,
          lastVote: lastVote,
          canVote: canVote,
          explorerURL: 'https://etherscan.io/address/' + gaugeAddress,
        };
        userGauges = [...userGauges, userGauge];
      }

      userGauges.sort(
        (a, b) => b.userWeight.toNumber() - a.userWeight.toNumber()
      );

      // populate user data for chart
      let data: number[] = [];
      let labels: string[] = [];
      let backgroundColor: string[] = [];
      let hoverBackgroundColor: string[] = [];

      for (let g in userGauges) {
        const gauge = userGauges[g];
        const color = 'rgba(' + this.COLORS[+g % this.COLORS.length] + ', 0.5)';
        const hover = 'rgba(' + this.COLORS[+g % this.COLORS.length] + ', 1)';

        data = [...data, gauge.userWeight.toNumber()];
        labels = [...labels, gauge.name];
        backgroundColor = [...backgroundColor, color];
        hoverBackgroundColor = [...hoverBackgroundColor, hover];
      }

      // fetch vote power used and add unused vote power (if any) to chart
      await gaugeController.methods
        .vote_user_power(address)
        .call()
        .then((result) => {
          this.votePowerUsed = new BigNumber(result).div(100);
        });
      if (this.votePowerUsed.lt(100)) {
        const unallocated = new BigNumber(100).minus(this.votePowerUsed);

        data = [...data, unallocated.toNumber()];
        labels = [...labels, 'Unallocated'];
        backgroundColor = [...backgroundColor, 'rgba(255, 255, 255, 0.5)'];
        backgroundColor = [...backgroundColor, 'rgba(255, 255, 255, 1)'];
      }

      // assign to global variables
      this.userGauges = userGauges;
      this.userChartLabels = labels;
      this.userChartData = [
        {
          data: data,
          backgroundColor: backgroundColor,
          hoverBackgroundColor: hoverBackgroundColor,
          borderWidth: 0.5,
        },
      ];

      this.loadingUser = false;
    }

    if (loadGlobal) {
      // fetch total and circulating MPH supply
      mph.methods
        .totalSupply()
        .call()
        .then((result) => {
          const supply = new BigNumber(result).div(this.constants.PRECISION);
          this.totalMPHSupply = supply;
          this.circulatingMPHSupply = this.circulatingMPHSupply.plus(supply);
        });
      mph.methods
        .balanceOf(this.constants.GOV_TREASURY[this.wallet.networkID])
        .call()
        .then((result) => {
          const balance = new BigNumber(result).div(this.constants.PRECISION);
          this.circulatingMPHSupply = this.circulatingMPHSupply.minus(balance);
        });
      mph.methods
        .balanceOf(this.constants.DEV_WALLET[this.wallet.networkID])
        .call()
        .then((result) => {
          const balance = new BigNumber(result).div(this.constants.PRECISION);
          this.circulatingMPHSupply = this.circulatingMPHSupply.minus(balance);
        });
      mph.methods
        .balanceOf(this.constants.MERKLE_DISTRIBUTOR[this.wallet.networkID])
        .call()
        .then((result) => {
          const balance = new BigNumber(result).div(this.constants.PRECISION);
          this.circulatingMPHSupply = this.circulatingMPHSupply.minus(balance);
        });

      // load gauge time left
      gaugeController.methods
        .time_total()
        .call()
        .then((result) => {
          this.timeLeft = parseInt(result);
          this.timeLeftCountdown = new Timer(this.timeLeft, 'down');
          this.timeLeftCountdown.start();
        });

      await vemph.methods
        .totalSupply()
        .call()
        .then((result) => {
          this.veTotal = new BigNumber(result).div(this.constants.PRECISION);
        });

      // @dev totalFXSSupply() returns a slightly different value than supply()
      await vemph.methods
        .supply()
        .call()
        .then((result) => {
          this.totalMPHLocked = new BigNumber(result).div(
            this.constants.PRECISION
          );
        });

      // @dev MPH * (3/4t + 1) = veMPH
      this.averageLock = this.veTotal
        .div(this.totalMPHLocked)
        .minus(1)
        .times(4)
        .div(3);

      // load the gauge data
      let gauges: Gauge[] = [];
      const numGauges = await gaugeController.methods.n_gauges().call();

      for (let i = 0; i < +numGauges; i++) {
        const gaugeAddress = await gaugeController.methods.gauges(i).call();
        const poolInfo = this.contract.getPoolInfoFromGauge(gaugeAddress);

        const gaugeWeight = new BigNumber(
          await gaugeController.methods
            .gauge_relative_weight(gaugeAddress)
            .call()
        )
          .div(this.constants.PRECISION)
          .times(100);

        const gaugeReward = new BigNumber(
          await gaugeDistributor.methods.currentReward(gaugeAddress).call()
        ).div(this.constants.PRECISION);

        const gauge: Gauge = {
          name: poolInfo.name,
          address: gaugeAddress,
          weight: gaugeWeight,
          reward: gaugeReward,
          explorerURL: 'https://etherscan.io/address/' + gaugeAddress,
        };
        gauges = [...gauges, gauge];
      }

      gauges.sort((a, b) => b.weight.toNumber() - a.weight.toNumber());

      // populate global data for chart
      let data: number[] = [];
      let labels: string[] = [];
      let backgroundColor: string[] = [];
      let hoverBackgroundColor: string[] = [];

      for (let g in gauges) {
        const gauge = gauges[g];
        const color = 'rgba(' + this.COLORS[+g % this.COLORS.length] + ', 0.5)';
        const hover = 'rgba(' + this.COLORS[+g % this.COLORS.length] + ', 1)';

        data = [...data, gauge.weight.toNumber()];
        labels = [...labels, gauge.name];
        backgroundColor = [...backgroundColor, color];
        hoverBackgroundColor = [...hoverBackgroundColor, hover];
      }

      // assign to global variables
      this.gauges = gauges;
      this.protocolChartLabels = labels;
      this.protocolChartData = [
        {
          data: data,
          backgroundColor: backgroundColor,
          hoverBackgroundColor: hoverBackgroundColor,
          borderWidth: 0.5,
        },
      ];

      this.loadingGlobal = false;
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
          ? [...this.gauges.sort((a, b) => a[column] - b[column])]
          : [...this.gauges.sort((a, b) => b[column] - a[column])];
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

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeComponent, {
      windowClass: 'fullscreen',
    });
  }
}

interface Gauge {
  name: string;
  address: string;
  weight: BigNumber;
  reward: BigNumber;
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
