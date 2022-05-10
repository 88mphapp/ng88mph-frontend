import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { DataService } from 'src/app/data.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { UserPool, UserDeposit, AllPool } from '../types';

@Component({
  selector: 'app-modal-top-up',
  templateUrl: './modal-top-up.component.html',
  styleUrls: ['./modal-top-up.component.css'],
})
export class ModalTopUpComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;
  @Input() mphDepositorRewardMintMultiplier: BigNumber;
  @Input() pool: AllPool;

  depositAmountToken: BigNumber;
  depositAmountUSD: BigNumber;
  depositTokenBalance: BigNumber;

  mphPriceUSD: BigNumber;
  interestRate: BigNumber;
  interestAmountToken: BigNumber;
  interestAmountUSD: BigNumber;
  depositMaturation: string;

  // new variables
  topupRewardAPR: BigNumber;
  totalRewardAPR: BigNumber;
  topupReward: BigNumber;
  totalReward: BigNumber;
  rewardRate: BigNumber;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    public data: DataService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData();
      this.loadData();
    });
  }

  async loadData() {
    let address = this.wallet.actualAddress;

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    // fetch the current reward rate for the pool
    const vest = this.contract.getNamedContract('Vesting03');
    let rewardRate = new BigNumber(0);
    if (vest.options.address) {
      rewardRate = await vest.methods.rewardRate(this.poolInfo.address).call();
    }
    this.rewardRate = rewardRate;

    const stablecoin = this.contract.getPoolStablecoin(this.poolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    this.depositTokenBalance = new BigNumber(
      await stablecoin.methods.balanceOf(address).call()
    ).div(stablecoinPrecision);
    this.depositMaturation = new Date(
      this.userDeposit.maturation * 1e3
    ).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    this.updateAPY();
  }

  resetData(): void {
    this.depositAmountToken = new BigNumber(0);
    this.depositAmountUSD = new BigNumber(0);
    this.depositTokenBalance = new BigNumber(0);

    this.mphPriceUSD = new BigNumber(0);
    this.interestRate = new BigNumber(0);
    this.interestAmountToken = new BigNumber(0);
    this.interestAmountUSD = new BigNumber(0);
    this.depositMaturation = new Date(Date.now()).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    this.topupRewardAPR = new BigNumber(0);
    this.totalRewardAPR = new BigNumber(0);
    this.topupReward = new BigNumber(0);
    this.totalReward = new BigNumber(0);
    this.rewardRate = new BigNumber(0);
  }

  async updateAPY() {
    const web3 = this.wallet.httpsWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, web3);
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      this.poolInfo.stablecoin,
      this.wallet.networkID
    );

    // get deposit amount
    this.depositAmountUSD = new BigNumber(this.depositAmountToken).times(
      stablecoinPrice
    );

    // get interest amount
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const depositAmountToken = this.helpers.processWeb3Number(
      this.depositAmountToken.times(stablecoinPrecision)
    );
    const currentTimestamp = Math.floor(Date.now() / 1e3);
    let depositTime: string;
    if (currentTimestamp >= this.userDeposit.maturation) {
      depositTime = '0';
    } else {
      depositTime = this.helpers.processWeb3Number(
        this.userDeposit.maturation - currentTimestamp
      );
    }
    const rawInterestAmountToken = new BigNumber(
      await pool.methods
        .calculateInterestAmount(depositAmountToken, depositTime)
        .call()
    );
    const interestAmountToken = new BigNumber(
      await this.helpers.applyFeeToInterest(
        rawInterestAmountToken,
        this.poolInfo
      )
    );

    this.interestAmountToken = new BigNumber(interestAmountToken).div(
      stablecoinPrecision
    );
    this.interestAmountUSD = new BigNumber(interestAmountToken)
      .div(stablecoinPrecision)
      .times(stablecoinPrice);

    // get APR
    this.interestRate = interestAmountToken
      .div(depositAmountToken)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (this.interestRate.isNaN()) {
      this.interestRate = new BigNumber(0);
    }

    // get MPH reward amount
    if (this.userDeposit.vest.lastUpdateTimestamp === 0) {
      // Vesting03

      // calculate the reward APR for the pool (including deposit amount)
      const mphAPR = this.rewardRate
        .times(this.constants.YEAR_IN_SEC)
        .times(this.mphPriceUSD)
        .div(this.pool.totalDeposits.plus(this.depositAmountToken))
        .div(stablecoinPrice)
        .times(100);
      this.topupRewardAPR = mphAPR.isNaN() ? new BigNumber(0) : mphAPR;
      this.totalRewardAPR = mphAPR.isNaN() ? new BigNumber(0) : mphAPR;

      // calculate the estimated reward for the top up amount
      const topupReward = this.rewardRate
        .times(this.depositAmountToken)
        .times(depositTime)
        .div(this.pool.totalDeposits.plus(this.depositAmountToken));
      this.topupReward = topupReward.isNaN() ? new BigNumber(0) : topupReward;

      // calculate the estimated reward for the total deposit
      // @dev does not include rewards that have already been earned
      const totalReward = this.rewardRate
        .times(this.depositAmountToken.plus(this.userDeposit.amount))
        .times(depositTime)
        .div(this.pool.totalDeposits.plus(this.depositAmountToken));
      this.totalReward = totalReward.isNaN() ? new BigNumber(0) : totalReward;
    } else {
      // Vesting02

      // calculate the reward for the top up amount
      const topupReward = this.mphDepositorRewardMintMultiplier
        .times(this.depositAmountToken)
        .times(depositTime);
      this.topupReward = topupReward.isNaN() ? new BigNumber(0) : topupReward;

      // calculate the reward for the total deposit
      const vest = this.userDeposit.vest;
      const totalReward = vest.totalExpectedMPHAmount.plus(this.topupReward);
      this.totalReward = totalReward.isNaN() ? new BigNumber(0) : totalReward;

      // calculate the reward APR for the top up amount
      const topupAPR = this.topupReward
        .times(this.mphPriceUSD)
        .div(this.depositAmountUSD)
        .div(depositTime)
        .times(this.constants.YEAR_IN_SEC)
        .times(100);
      this.topupRewardAPR = topupAPR.isNaN() ? new BigNumber(0) : topupAPR;

      // calculate the reward APR for the total deposit
      const totalAPR = this.totalReward
        .times(this.mphPriceUSD)
        .div(this.userDeposit.amountUSD.plus(this.depositAmountUSD))
        .div(this.userDeposit.depositLength)
        .times(this.constants.YEAR_IN_SEC)
        .times(100);
      this.totalRewardAPR = totalAPR.isNaN() ? new BigNumber(0) : totalAPR;
    }
  }

  setDepositAmount(amount: string) {
    this.depositAmountToken = new BigNumber(+amount);
    if (this.depositAmountToken.isNaN()) {
      this.depositAmountToken = new BigNumber(0);
    }
    this.updateAPY();
  }

  presetDepositAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.depositAmountToken = this.depositTokenBalance.times(ratio);
    this.updateAPY();
  }

  setMaxDepositAmount() {
    this.depositAmountToken = this.depositTokenBalance;
    this.updateAPY();
  }

  deposit() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const stablecoin = this.contract.getPoolStablecoin(this.poolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const depositAmountToken = this.helpers.processWeb3Number(
      this.depositAmountToken.times(stablecoinPrecision)
    );
    const func = pool.methods.topupDeposit(
      this.userDeposit.nftID,
      depositAmountToken
    );

    this.wallet.sendTxWithToken(
      func,
      stablecoin,
      this.poolInfo.address,
      depositAmountToken,
      () => {
        this.activeModal.dismiss();
      },
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  canContinue() {
    return (
      this.wallet.connected &&
      this.depositAmountToken.gt(0) &&
      this.depositAmountToken.lte(this.depositTokenBalance)
    );
  }
}
