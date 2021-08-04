import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { UserDeposit, UserZCBPool } from '../types';

@Component({
  selector: 'app-modal-withdraw-zcb',
  templateUrl: './modal-withdraw-zcb.component.html',
  styleUrls: ['./modal-withdraw-zcb.component.css'],
})
export class ModalWithdrawZCBComponent implements OnInit {
  @Input() userZCBPool: UserZCBPool;

  stablecoinPriceUSD: BigNumber;
  withdrawAmount: BigNumber;

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
    if (this.userZCBPool.amountToken.gt(0)) {
      this.stablecoinPriceUSD = this.userZCBPool.amountUSD.div(
        this.userZCBPool.amountToken
      );
    } else {
      this.stablecoinPriceUSD = new BigNumber(
        await this.helpers.getTokenPriceUSD(
          this.userZCBPool.poolInfo.stablecoin
        )
      );
    }
  }

  resetData() {
    this.stablecoinPriceUSD = new BigNumber(0);
    this.withdrawAmount = new BigNumber(0);
  }

  withdraw() {
    const zcb = this.contract.getZeroCouponBondContract(
      this.userZCBPool.zcbPoolInfo.address
    );
    const stablecoinPrecision = Math.pow(
      10,
      this.userZCBPool.poolInfo.stablecoinDecimals
    );
    const redeemAmount = this.helpers.processWeb3Number(
      this.withdrawAmount.times(stablecoinPrecision)
    );
    const func = zcb.methods.redeem(redeemAmount, true);

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
  }

  setMaxWithdrawAmount(): void {
    this.setWithdrawAmount(this.userZCBPool.amountToken.toString());
  }
}
