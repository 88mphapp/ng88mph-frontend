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

  withdrawAmount: BigNumber;
  mphRewardAmount: BigNumber;
  mphBalance: BigNumber;
  mphPriceUSD: BigNumber;

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
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }

  async loadData() {
    this.mphRewardAmount = this.userDeposit.realMPHReward;

    const mphToken = this.contract.getNamedContract(
      'MPHToken',
      this.wallet.readonlyWeb3()
    );
    this.mphBalance = new BigNumber(
      await mphToken.methods.balanceOf(this.wallet.userAddress).call()
    ).div(this.constants.PRECISION);
  }

  resetData() {
    this.withdrawAmount = new BigNumber(0);
    this.mphRewardAmount = new BigNumber(0);
    this.mphBalance = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

  withdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const withdrawVirtualTokenAmount = this.helpers.processWeb3Number(
      this.getVirtualTokenAmount().times(stablecoinPrecision)
    );
    const early = this.userDeposit.locked;
    const func = pool.methods.withdraw(
      this.userDeposit.nftID,
      withdrawVirtualTokenAmount,
      early
    );

    this.wallet.sendTx(
      func,
      () => {},
      () => {
        this.activeModal.dismiss();
      },
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  setWithdrawAmount(amount: string) {
    this.withdrawAmount = new BigNumber(+amount);
    if (this.withdrawAmount.isNaN()) {
      this.withdrawAmount = new BigNumber(0);
    }
  }

  setMaxWithdrawAmount(): void {
    this.withdrawAmount = new BigNumber(this.userDeposit.amountToken);
  }

  getVirtualTokenAmount(): BigNumber {
    const withdrawRatio = this.withdrawAmount.div(this.userDeposit.amountToken);
    const virtualTokenTotalSupply = this.userDeposit.virtualTokenTotalSupply;
    const virtualTokensToWithdraw =
      virtualTokenTotalSupply.times(withdrawRatio);
    return virtualTokensToWithdraw;
  }
}
