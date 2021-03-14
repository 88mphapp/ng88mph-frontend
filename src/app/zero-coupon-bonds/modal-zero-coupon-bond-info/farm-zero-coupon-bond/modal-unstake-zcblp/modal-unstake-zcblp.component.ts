import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ZeroCouponBondTableEntry } from 'src/app/zero-coupon-bonds/zero-coupon-bonds.component';

@Component({
  selector: 'app-modal-unstake-zcblp',
  templateUrl: './modal-unstake-zcblp.component.html',
  styleUrls: ['./modal-unstake-zcblp.component.css']
})
export class ModalUnstakeZCBLPComponent implements OnInit {
  @Input() stakedTokenPoolProportion: BigNumber;
  @Input() stakedTokenBalance: BigNumber;
  @Input() totalStakedTokenBalance: BigNumber;
  @Input() totalRewardPerSecond: BigNumber;
  @Input() rewardPerDay: BigNumber;
  @Input() rewardTokenPriceUSD: BigNumber;
  @Input() zcbEntry: ZeroCouponBondTableEntry;
  unstakeAmount: BigNumber;
  newStakedTokenPoolProportion: BigNumber;
  newRewardPerDay: BigNumber;

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
    this.setUnstakeAmount(this.stakedTokenBalance.toFixed(18));
  }

  resetData(): void {
    this.unstakeAmount = new BigNumber(0);
    this.newStakedTokenPoolProportion = new BigNumber(0);
    this.newRewardPerDay = new BigNumber(0);
  }

  setUnstakeAmount(amount: number | string) {
    this.unstakeAmount = new BigNumber(amount);
    if (this.unstakeAmount.isNaN()) {
      this.unstakeAmount = new BigNumber(0);
    }
    this.newStakedTokenPoolProportion = this.stakedTokenBalance.minus(this.unstakeAmount).div(this.totalStakedTokenBalance.minus(this.unstakeAmount)).times(100);
    if (this.newStakedTokenPoolProportion.isNaN()) {
      this.newStakedTokenPoolProportion = new BigNumber(0);
    }
    this.newRewardPerDay = this.stakedTokenBalance.minus(this.unstakeAmount).times(this.totalRewardPerSecond.div(this.totalStakedTokenBalance.minus(this.unstakeAmount))).times(this.constants.DAY_IN_SEC);
    if (this.newRewardPerDay.isNaN()) {
      this.newRewardPerDay = new BigNumber(0);
    }
  }

  unstake() {
    const rewards = this.contract.getContract(this.zcbEntry.zcbInfo.farmAddress, 'Farming');
    const unstakeAmount = this.helpers.processWeb3Number(this.unstakeAmount.times(this.constants.PRECISION));
    const func = rewards.methods.withdraw(unstakeAmount);

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected && this.unstakeAmount.gt(0);
  }
}
