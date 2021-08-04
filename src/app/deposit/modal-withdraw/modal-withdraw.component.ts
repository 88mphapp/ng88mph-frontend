import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { UserDeposit } from '../types';

@Component({
  selector: 'app-modal-withdraw',
  templateUrl: './modal-withdraw.component.html',
  styleUrls: ['./modal-withdraw.component.css'],
})
export class ModalWithdrawComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;

  stablecoinPriceUSD: BigNumber;
  withdrawAmount: BigNumber;
  earlyWithdrawFee: BigNumber;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    if (this.userDeposit.amountToken.gt(0)) {
      this.stablecoinPriceUSD = this.userDeposit.amountUSD.div(
        this.userDeposit.amountToken
      );
    } else {
      this.stablecoinPriceUSD = new BigNumber(
        await this.helpers.getTokenPriceUSD(this.poolInfo.stablecoin)
      );
    }
  }

  resetData() {
    this.stablecoinPriceUSD = new BigNumber(0);
    this.withdrawAmount = new BigNumber(0);
    this.earlyWithdrawFee = new BigNumber(0);
  }

  withdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const withdrawVirtualTokenAmount = this.helpers.processWeb3Number(
      this.withdrawVirtualTokenAmount.times(stablecoinPrecision)
    );
    const early = this.userDeposit.locked;
    const func = pool.methods.withdraw(
      this.userDeposit.nftID,
      withdrawVirtualTokenAmount,
      early
    );

    this.wallet.sendTx(
      func,
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

  async setWithdrawAmount(amount: string) {
    this.withdrawAmount = new BigNumber(+amount);
    if (this.withdrawAmount.isNaN()) {
      this.withdrawAmount = new BigNumber(0);
    }
    this.earlyWithdrawFee = await this.getEarlyWithdrawFee();
  }

  async presetWithdrawAmount(percent: string | number) {
    const ratio = new BigNumber(percent).div(100);
    const withdrawAmount = this.maxWithdrawAmountToken.times(ratio);
    this.setWithdrawAmount(withdrawAmount.toString());
  }

  setMaxWithdrawAmount(): void {
    this.setWithdrawAmount(this.maxWithdrawAmountToken.toString());
  }

  get maxWithdrawAmountToken(): BigNumber {
    if (this.userDeposit.locked) {
      return this.userDeposit.amountToken;
    } else {
      return this.userDeposit.virtualTokenTotalSupply;
    }
  }

  get withdrawVirtualTokenAmount(): BigNumber {
    if (this.userDeposit.locked) {
      const withdrawRatio = this.withdrawAmount.div(
        this.maxWithdrawAmountToken
      );
      const virtualTokenTotalSupply = this.userDeposit.virtualTokenTotalSupply;
      const virtualTokensToWithdraw =
        virtualTokenTotalSupply.times(withdrawRatio);
      return virtualTokensToWithdraw;
    } else {
      return this.withdrawAmount;
    }
  }

  applyWithdrawRatio(n: BigNumber): BigNumber {
    const withdrawRatio = this.withdrawAmount.div(this.maxWithdrawAmountToken);
    return withdrawRatio.times(n);
  }

  async getEarlyWithdrawFee(): Promise<BigNumber> {
    if (!this.userDeposit.locked) {
      return new BigNumber(0);
    }
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, readonlyWeb3);
    const feeModelAddress = await pool.methods.feeModel().call();
    const feeModel = this.contract.getContract(
      feeModelAddress,
      'IFeeModel',
      readonlyWeb3
    );
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const processedWithdrawAmount = this.helpers.processWeb3Number(
      this.withdrawAmount.times(stablecoinPrecision)
    );
    const feeAmount = new BigNumber(
      await feeModel.methods
        .getEarlyWithdrawFeeAmount(
          this.poolInfo.address,
          this.userDeposit.nftID,
          processedWithdrawAmount
        )
        .call()
    ).div(stablecoinPrecision);
    return feeAmount;
  }

  get totalWithdrawAmount(): BigNumber {
    const interestAmountToken = this.userDeposit.locked
      ? 0
      : this.userDeposit.interestEarnedToken;
    return this.applyWithdrawRatio(
      this.userDeposit.amountToken.plus(interestAmountToken)
    ).minus(this.earlyWithdrawFee);
  }
}
