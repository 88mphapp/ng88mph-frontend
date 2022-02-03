// TODO
// 1- Change veMPH address to correct address after deployment (contracts.json and constants.service.ts)
// 2- Change MPHGaugeController address to correct address after deployment (contracts.json)
// 2- Change MPHGaugeRewardDistributor address to correct address after deployment (contracts.json)
// 3- Add checks for extending lock duration (e.g. can't add 4 years to an existing 3 year lock)
// 4- Prompt network switch if not connected to Mainnet
// 5- Disable actions if not connected to Mainnet
// 6- Ensure action flow works as expected (reloads data, etc)

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
    // change chart colors by changing these
    '107, 94, 174',
    '72, 69, 84',
    '173, 169, 187',
    '174, 73, 66',
    '234, 125, 114',
  ];

  // user variables
  mphLocked: BigNumber; // amount of MPH user has locked
  mphBalance: BigNumber; // user's MPH balance in wallet
  mphAllowance: BigNumber; // user's MPH allowance for the veMPH contract
  mphUnlocked: BigNumber; // amount of MPH user can unlock
  veBalance: BigNumber; // user's veMPH balance
  lockEnd: number; // timestamp when user's lock ends
  lockAmount: BigNumber; // amount of MPH to lock
  lockDuration: number; // days to lock
  userChartLabels: string[];
  userChartData: {};

  // global variables
  veTotal: BigNumber;
  totalMPHSupply: BigNumber;
  circulatingMPHSupply: BigNumber; // circulating = total - gov treasury - dev wallet - merkle distributor
  totalMPHLocked: BigNumber;
  averageLock: BigNumber;

  // gauge
  timeLeft: number;
  timeLeftCountdown: any;

  gauges: Gauge[];
  userGauges: any;

  // chart variables
  chartType = 'pie'; // constant for all charts
  chartLegend = false; // constant for all charts
  chartOptions = {}; // constant for all charts

  protocolChartLabels: string[];
  protocolChartData: {};

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

      this.userChartLabels = [];
      this.userChartData = [];
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
    }
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const address = this.wallet.actualAddress.toLowerCase();

    const mph = this.contract.getNamedContract('MPHToken', web3);
    const vemph = this.contract.getNamedContract('veMPH', web3);
    // @dev currently using address for FXSGaugeController during development
    const gaugeController = this.contract.getNamedContract(
      'MPHGaugeController',
      web3
    );
    // @dev currently using address for FXSGaugeRewardDistributor during development
    const gaugeDistributor = this.contract.getNamedContract(
      'MPHGaugeRewardDistributor',
      web3
    );

    if (loadUser && address) {
      // load user MPH balance
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
        // load user's current voting power
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
        vemph.methods
          .locked(address)
          .call()
          .then((result) => {
            const now = Math.floor(Date.now() / 1e3);
            const amount = new BigNumber(result.amount).div(
              this.constants.PRECISION
            );
            this.lockEnd = parseInt(result.end);
            this.lockEnd > now
              ? (this.mphLocked = amount)
              : (this.mphUnlocked = amount);
          });
      }
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
      // @dev switch to subgraph queries once a subgraph has been developed and deployed
      let gauges: Gauge[] = [];
      let labels: string[] = [];
      let data: number[] = [];
      let backgroundColor: string[] = [];

      const numGauges = await gaugeController.methods.n_gauges().call();
      for (let i = 0; i < +numGauges; i++) {
        const gaugeAddress = await gaugeController.methods.gauges(i).call();
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
          name: 'Gauge ' + i, // @dev needs to be married with DPool name
          address: gaugeAddress,
          weight: gaugeWeight,
          reward: gaugeReward,
        };
        gauges = [...gauges, gauge];
        labels = [...labels, gaugeAddress.slice(0, 5)];
        data = [...data, gaugeWeight.toNumber()];
        backgroundColor = [
          ...backgroundColor,
          'rgba(' + this.COLORS[i % this.COLORS.length] + ', 0.5)',
        ];
      }
      gauges.sort((a, b) => b.weight.toNumber() - a.weight.toNumber());
      this.gauges = gauges;
      this.protocolChartLabels = labels;
      this.protocolChartData = [
        {
          data: data,
          backgroundColor: backgroundColor,
          borderWidth: 0.5,
        },
      ];
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
}
