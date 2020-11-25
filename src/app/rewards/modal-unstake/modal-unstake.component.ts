import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-unstake',
  templateUrl: './modal-unstake.component.html',
  styleUrls: ['./modal-unstake.component.css']
})
export class ModalUnstakeComponent implements OnInit {
  @Input() stakedMPHPoolProportion: BigNumber;
  @Input() stakedMPHBalance: BigNumber;
  @Input() totalStakedMPHBalance: BigNumber;
  @Input() totalRewardPerSecond: BigNumber;
  @Input() rewardPerWeek: BigNumber;
  unstakeAmount: BigNumber;
  newStakedMPHPoolProportion: BigNumber;
  newRewardPerWeek: BigNumber;

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
    if (this.wallet.connected) {
      this.loadData();
    }
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    this.setUnstakeAmount(this.stakedMPHBalance.toFixed(18));
  }

  resetData(): void {
    this.unstakeAmount = new BigNumber(0);
    this.newStakedMPHPoolProportion = new BigNumber(0);
    this.newRewardPerWeek = new BigNumber(0);
  }

  setUnstakeAmount(amount: number | string) {
    this.unstakeAmount = new BigNumber(amount);
    if (this.unstakeAmount.isNaN()) {
      this.unstakeAmount = new BigNumber(0);
    }
    this.newStakedMPHPoolProportion = this.stakedMPHBalance.minus(this.unstakeAmount).div(this.totalStakedMPHBalance.minus(this.unstakeAmount)).times(100);
    if (this.newStakedMPHPoolProportion.isNaN()) {
      this.newStakedMPHPoolProportion = new BigNumber(0);
    }
    this.newRewardPerWeek = this.stakedMPHBalance.minus(this.unstakeAmount).times(this.totalRewardPerSecond.div(this.totalStakedMPHBalance.minus(this.unstakeAmount))).times(this.constants.WEEK_IN_SEC);
    if (this.newRewardPerWeek.isNaN()) {
      this.newRewardPerWeek = new BigNumber(0);
    }
  }

  unstake() {
    const rewards = this.contract.getNamedContract('Rewards');
    const unstakeAmount = this.helpers.processWeb3Number(this.unstakeAmount.times(this.constants.PRECISION));
    const func = rewards.methods.withdraw(unstakeAmount);

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected && this.unstakeAmount.gt(0);
  }
}