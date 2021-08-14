import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { DPool, UserPool, UserDeposit } from '../types';

@Component({
  selector: 'app-modal-top-up',
  templateUrl: './modal-top-up.component.html',
  styleUrls: ['./modal-top-up.component.css'],
})
export class ModalTopUpComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;
  @Input() mphDepositorRewardMintMultiplier: BigNumber;

  depositAmountToken: BigNumber;
  depositAmountUSD: BigNumber;
  depositTokenBalance: BigNumber;

  mphPriceUSD: BigNumber;
  interestRate: BigNumber;
  interestAmountToken: BigNumber;
  interestAmountUSD: BigNumber;
  mphRewardAmountToken: BigNumber;
  mphRewardAmountUSD: BigNumber;
  mphRewardAPR: BigNumber;
  depositMaturation: string;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
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

    const stablecoin = this.contract.getPoolStablecoin(this.poolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    this.depositTokenBalance = new BigNumber(
      await stablecoin.methods.balanceOf(address).call()
    ).div(stablecoinPrecision);

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
    this.mphRewardAmountToken = new BigNumber(0);
    this.mphRewardAmountUSD = new BigNumber(0);
    this.mphRewardAPR = new BigNumber(0);
    this.depositMaturation = new Date(Date.now()).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async updateAPY() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, readonlyWeb3);
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      this.poolInfo.stablecoin
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
    if (currentTimestamp >= this.userDeposit.maturationTimestamp) {
      depositTime = '0';
    } else {
      depositTime = this.helpers.processWeb3Number(
        this.userDeposit.maturationTimestamp - currentTimestamp
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
    this.mphRewardAmountToken = this.mphDepositorRewardMintMultiplier
      .times(this.depositAmountToken)
      .times(depositTime);
    this.mphRewardAmountUSD = this.mphRewardAmountToken.times(this.mphPriceUSD);

    const mphAPY = this.mphRewardAmountToken
      .times(this.mphPriceUSD)
      .div(this.depositAmountUSD)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (mphAPY.isNaN()) {
      this.mphRewardAPR = new BigNumber(0);
    } else {
      this.mphRewardAPR = mphAPY;
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
