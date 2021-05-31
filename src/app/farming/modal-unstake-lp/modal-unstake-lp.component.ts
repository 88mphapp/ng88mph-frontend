import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-unstake-lp',
  templateUrl: './modal-unstake-lp.component.html',
  styleUrls: ['./modal-unstake-lp.component.css']
})
export class ModalUnstakeLPComponent implements OnInit {
  @Input() selectedPool: string;


  @Input() stakedMPHPoolProportion: BigNumber;
  @Input() stakedMPHBalance: BigNumber;
  @Input() totalStakedMPHBalance: BigNumber;
  @Input() totalRewardPerSecond: BigNumber;
  @Input() rewardPerDay: BigNumber;
  @Input() mphPriceUSD: BigNumber;

  @Input() sushiStakedLPBalance: BigNumber;

  stakedAmount: BigNumber;
  unstakeAmount: BigNumber;
  newStakedMPHPoolProportion: BigNumber;
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
    if (this.selectedPool === "Uniswap v2") {
      this.setUnstakeAmount(this.stakedMPHBalance.toFixed(18));
      this.stakedAmount = this.stakedMPHBalance;
    } else if (this.selectedPool === "SushiSwap") {
      this.setUnstakeAmount(this.sushiStakedLPBalance.toFixed(18));
      this.stakedAmount = this.sushiStakedLPBalance;
    }
  }

  resetData(): void {
    this.stakedAmount = new BigNumber(0);
    this.unstakeAmount = new BigNumber(0);
    this.newStakedMPHPoolProportion = new BigNumber(0);
    this.newRewardPerDay = new BigNumber(0);
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
    this.newRewardPerDay = this.stakedMPHBalance.minus(this.unstakeAmount).times(this.totalRewardPerSecond.div(this.totalStakedMPHBalance.minus(this.unstakeAmount))).times(this.constants.DAY_IN_SEC);
    if (this.newRewardPerDay.isNaN()) {
      this.newRewardPerDay = new BigNumber(0);
    }
  }

  unstake() {
    const unstakeAmount = this.helpers.processWeb3Number(this.unstakeAmount.times(this.constants.PRECISION));
    let rewards;
    let func;

    if (this.selectedPool === "Uniswap v2") {
      rewards = this.contract.getNamedContract('Farming');
      func = rewards.methods.withdraw(unstakeAmount);
    } else if (this.selectedPool === "SushiSwap") {
      rewards = this.contract.getNamedContract('MasterChef');
      func = rewards.methods.withdraw(this.constants.SUSHI_MPH_ONSEN_ID, unstakeAmount);
    }

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected && this.unstakeAmount.gt(0) && this.unstakeAmount.lte(this.stakedAmount);
  }
}
