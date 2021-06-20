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
    this.mphRewardAmount = this.userDeposit.mintMPHAmount;

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
    const func = pool.methods.withdraw(
      this.userDeposit.nftID,
      this.userDeposit.fundingID
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

  earlyWithdraw() {
    // v2 code //
    // const pool = this.contract.getPool(this.poolInfo.name);
    // const mphToken = this.contract.getNamedContract('MPHToken');
    // const mphMinter = this.contract.getNamedContractAddress('MPHMinter');
    // const mphAmount = this.helpers.processWeb3Number(this.mphTakeBackAmount.times(this.constants.PRECISION));
    // const func = pool.methods.earlyWithdraw(this.userDeposit.nftID, this.userDeposit.fundingID);
    // this.wallet.sendTxWithToken(func, mphToken, mphMinter, mphAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });

    // v3 code //
    // const pool = this.contract.getPool(this.poolInfo.name);
    // const virtualTokensToWithdraw = this.getVirtualTokenAmount();
    // console.log(virtualTokensToWithdraw);
    // const func = pool.methods.withdraw(this.userDeposit.nftID, virtualTokensToWithdraw, true);
    // console.log(this.userDeposit);

    console.log('You still need to implement this!');
  }

  setWithdrawAmount(amount: string) {
    this.withdrawAmount = new BigNumber(+amount);
    console.log(this.withdrawAmount);
  }

  setMaxWithdrawAmount(): void {
    this.withdrawAmount = new BigNumber(this.userDeposit.amountToken);
    console.log(this.withdrawAmount);
  }

  //getVirtualTokenAmount(): BigNumber {
  // const withdrawRatio = this.withdrawAmount.div(this.userDeposit.amountToken);
  // const virtualTokenTotalSupply = this.userDeposit.virtualTokenTotalSupply;
  // const virtualTokensToWithdraw = virtualTokenTotalSupply.times(withdrawRatio);
  // return virtualTokensToWithdraw;
  //}
}
