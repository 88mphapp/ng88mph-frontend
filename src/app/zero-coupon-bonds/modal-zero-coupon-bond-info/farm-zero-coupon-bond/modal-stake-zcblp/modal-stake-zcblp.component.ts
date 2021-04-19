import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ZeroCouponBondTableEntry } from 'src/app/zero-coupon-bonds/zero-coupon-bonds.component';

@Component({
  selector: 'app-modal-stake-zcblp',
  templateUrl: './modal-stake-zcblp.component.html',
  styleUrls: ['./modal-stake-zcblp.component.css']
})
export class ModalStakeZCBLPComponent implements OnInit {

  @Input() stakedTokenPoolProportion: BigNumber;
  @Input() stakedTokenBalance: BigNumber;
  @Input() totalStakedTokenBalance: BigNumber;
  @Input() totalRewardPerSecond: BigNumber;
  @Input() rewardPerDay: BigNumber;
  @Input() rewardTokenPriceUSD: BigNumber;
  @Input() zcbEntry: ZeroCouponBondTableEntry;
  stakeTokenBalance: BigNumber;
  stakeAmount: BigNumber;
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
    const lpToken = this.contract.getContract(this.zcbEntry.zcbInfo.sushiSwapPair, 'MPHLP');
    this.stakeTokenBalance = new BigNumber(await lpToken.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
    this.setStakeAmount(this.stakeTokenBalance.toFixed(18));
  }

  resetData(): void {
    this.stakeTokenBalance = new BigNumber(0);
    this.stakeAmount = new BigNumber(0);
    this.newStakedTokenPoolProportion = new BigNumber(0);
    this.newRewardPerDay = new BigNumber(0);
  }

  setStakeAmount(amount: number | string) {
    this.stakeAmount = new BigNumber(amount);
    if (this.stakeAmount.isNaN()) {
      this.stakeAmount = new BigNumber(0);
    }
    this.newStakedTokenPoolProportion = this.stakedTokenBalance.plus(this.stakeAmount).div(this.totalStakedTokenBalance.plus(this.stakeAmount)).times(100);
    if (this.newStakedTokenPoolProportion.isNaN()) {
      this.newStakedTokenPoolProportion = new BigNumber(0);
    }
    this.newRewardPerDay = this.stakedTokenBalance.plus(this.stakeAmount).times(this.totalRewardPerSecond.div(this.totalStakedTokenBalance.plus(this.stakeAmount))).times(this.constants.DAY_IN_SEC);
    if (this.newRewardPerDay.isNaN()) {
      this.newRewardPerDay = new BigNumber(0);
    }
  }

  stake() {
    const rewards = this.contract.getContract(this.zcbEntry.zcbInfo.farmAddress, 'Farming');
    const lpToken = this.contract.getContract(this.zcbEntry.zcbInfo.sushiSwapPair, 'MPHLP');
    const stakeAmount = this.helpers.processWeb3Number(this.stakeAmount.times(this.constants.PRECISION));
    const func = rewards.methods.stake(stakeAmount);

    this.wallet.sendTxWithToken(func, lpToken, rewards.options.address, stakeAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected && this.stakeAmount.gt(0);
  }
}
