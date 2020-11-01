import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { WalletService } from 'src/app/wallet.service';
import { UserDeposit } from '../types';

@Component({
  selector: 'app-modal-withdraw',
  templateUrl: './modal-withdraw.component.html',
  styleUrls: ['./modal-withdraw.component.css']
})
export class ModalWithdrawComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;
  mphRewardAmount: BigNumber;
  mphTakeBackAmount: BigNumber;
  mphBalance: BigNumber;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    const mphMinter = this.contract.getNamedContract('MPHMinter');
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const poolMintingMultiplier = new BigNumber(await mphMinter.methods.poolMintingMultiplier(this.poolInfo.address).call()).div(this.constants.PRECISION);
    const poolDepositorRewardMultiplier = new BigNumber(await mphMinter.methods.poolDepositorRewardMultiplier(this.poolInfo.address).call()).div(this.constants.PRECISION);
    this.mphRewardAmount = poolMintingMultiplier.times(this.userDeposit.interestEarnedToken).times(stablecoinPrecision).div(this.constants.PRECISION);
    this.mphTakeBackAmount = this.userDeposit.locked ? this.mphRewardAmount : new BigNumber(1).minus(poolDepositorRewardMultiplier).times(this.mphRewardAmount);

    const mphToken = this.contract.getNamedContract('MPHToken');
    this.mphBalance = new BigNumber(await mphToken.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
  }

  resetData() {
    this.mphRewardAmount = new BigNumber(0);
    this.mphTakeBackAmount = new BigNumber(0);
    this.mphBalance = new BigNumber(0);
  }

  withdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const func = pool.methods.withdraw(this.userDeposit.nftID, this.userDeposit.fundingID);

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, console.log);
  }

  earlyWithdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const func = pool.methods.earlyWithdraw(this.userDeposit.nftID, this.userDeposit.fundingID);

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, console.log);
  }
}
