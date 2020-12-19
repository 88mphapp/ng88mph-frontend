import { Component, Input, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-stake',
  templateUrl: './modal-stake.component.html',
  styleUrls: ['./modal-stake.component.css']
})
export class ModalStakeComponent implements OnInit {
  @Input() stakedMPHPoolProportion: BigNumber;
  @Input() stakedMPHBalance: BigNumber;
  @Input() totalStakedMPHBalance: BigNumber;
  @Input() totalRewardPerSecond: BigNumber;
  @Input() rewardPerWeek: BigNumber;
  mphBalance: BigNumber;
  stakeAmount: BigNumber;
  newStakedMPHPoolProportion: BigNumber;
  newRewardPerWeek: BigNumber;

  constructor(
    private apollo: Apollo,
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
    const mphToken = this.contract.getNamedContract('MPHToken', this.wallet.readonlyWeb3());
    this.mphBalance = new BigNumber(await mphToken.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
    this.setStakeAmount(this.mphBalance.toFixed(18));
  }

  resetData(): void {
    this.mphBalance = new BigNumber(0);
    this.stakeAmount = new BigNumber(0);
    this.newStakedMPHPoolProportion = new BigNumber(0);
    this.newRewardPerWeek = new BigNumber(0);
  }

  setStakeAmount(amount: number | string) {
    this.stakeAmount = new BigNumber(amount);
    if (this.stakeAmount.isNaN()) {
      this.stakeAmount = new BigNumber(0);
    }
    this.newStakedMPHPoolProportion = this.stakedMPHBalance.plus(this.stakeAmount).div(this.totalStakedMPHBalance.plus(this.stakeAmount)).times(100);
    if (this.newStakedMPHPoolProportion.isNaN()) {
      this.newStakedMPHPoolProportion = new BigNumber(0);
    }
    this.newRewardPerWeek = this.stakedMPHBalance.plus(this.stakeAmount).times(this.totalRewardPerSecond.div(this.totalStakedMPHBalance.plus(this.stakeAmount))).times(this.constants.WEEK_IN_SEC);
    if (this.newRewardPerWeek.isNaN()) {
      this.newRewardPerWeek = new BigNumber(0);
    }
  }

  stake() {
    const rewards = this.contract.getNamedContract('Rewards');
    const mphToken = this.contract.getNamedContract('MPHToken');
    const stakeAmount = this.helpers.processWeb3Number(this.stakeAmount.times(this.constants.PRECISION));
    const func = rewards.methods.stake(stakeAmount);

    this.wallet.sendTxWithToken(func, mphToken, rewards.options.address, stakeAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected && this.stakeAmount.gt(0);
  }
}
