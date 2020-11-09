import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-stake-lp',
  templateUrl: './modal-stake-lp.component.html',
  styleUrls: ['./modal-stake-lp.component.css']
})
export class ModalStakeLPComponent implements OnInit {
  LPTOKEN_ADDR = '0xfd9aACca3c5F8EF3AAa787E5Cb8AF0c041D8875f';

  @Input() stakedMPHPoolProportion: BigNumber;
  @Input() stakedMPHBalance: BigNumber;
  @Input() totalStakedMPHBalance: BigNumber;
  @Input() totalRewardPerSecond: BigNumber;
  @Input() rewardPerDay: BigNumber;
  mphBalance: BigNumber;
  stakeAmount: BigNumber;
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
      this.loadData();
    });
    this.wallet.errorEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    const lpToken = this.contract.getERC20(this.LPTOKEN_ADDR);
    this.mphBalance = new BigNumber(await lpToken.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
    this.setStakeAmount(this.mphBalance.toString());
  }

  resetData(): void {
    this.mphBalance = new BigNumber(0);
    this.stakeAmount = new BigNumber(0);
    this.newStakedMPHPoolProportion = new BigNumber(0);
    this.newRewardPerDay = new BigNumber(0);
  }

  setStakeAmount(amount: number | string) {
    this.stakeAmount = new BigNumber(+amount);
    this.newStakedMPHPoolProportion = this.stakedMPHBalance.plus(this.stakeAmount).div(this.totalStakedMPHBalance.plus(this.stakeAmount)).times(100);
    if (this.newStakedMPHPoolProportion.isNaN()) {
      this.newStakedMPHPoolProportion = new BigNumber(0);
    }
    const dayInSeconds = 24 * 60 * 60;
    this.newRewardPerDay = this.stakedMPHBalance.plus(this.stakeAmount).times(this.totalRewardPerSecond.div(this.totalStakedMPHBalance.plus(this.stakeAmount))).times(dayInSeconds);
    if (this.newRewardPerDay.isNaN()) {
      this.newRewardPerDay = new BigNumber(0);
    }
  }

  stake() {
    const rewards = this.contract.getNamedContract('Farming');
    const lpToken = this.contract.getERC20(this.LPTOKEN_ADDR);
    const stakeAmount = this.helpers.processWeb3Number(this.stakeAmount.times(this.constants.PRECISION));
    const func = rewards.methods.stake(stakeAmount);

    this.wallet.sendTxWithToken(func, lpToken, rewards.options.address, stakeAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }
}
