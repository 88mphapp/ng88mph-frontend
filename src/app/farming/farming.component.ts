import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { ModalStakeLPComponent } from './modal-stake-lp/modal-stake-lp.component';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';

@Component({
  selector: 'app-farming',
  templateUrl: './farming.component.html',
  styleUrls: ['./farming.component.css']
})
export class FarmingComponent implements OnInit {
  PERIOD = 14; // 14 days

  stakedMPHBalance: BigNumber;
  stakedMPHPoolProportion: BigNumber;
  claimableRewards: BigNumber;
  rewardPerDay: BigNumber;
  totalRewardPerSecond: BigNumber;
  rewardPerMPHPerSecond: BigNumber;
  totalStakedMPHBalance: BigNumber;
  mphPriceUSD: BigNumber;
  mphLPPriceUSD: BigNumber;
  yearlyROI: BigNumber;
  monthlyROI: BigNumber;
  weeklyROI: BigNumber;
  dailyROI: BigNumber;

  constructor(
    private modalService: NgbModal,
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
    const rewards = this.contract.getNamedContract('Farming');

    this.totalStakedMPHBalance = new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION);
    this.totalRewardPerSecond = new BigNumber(await rewards.methods.rewardRate().call()).div(this.constants.PRECISION);
    this.rewardPerMPHPerSecond = this.totalRewardPerSecond.div(this.totalStakedMPHBalance);
    if (this.totalStakedMPHBalance.isZero()) {
      this.rewardPerMPHPerSecond = new BigNumber(0);
    }

    this.stakedMPHBalance = new BigNumber(await rewards.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
    this.stakedMPHPoolProportion = this.stakedMPHBalance.div(this.totalStakedMPHBalance).times(100);
    if (this.totalStakedMPHBalance.isZero()) {
      this.stakedMPHPoolProportion = new BigNumber(0);
    }
    this.rewardPerDay = this.stakedMPHBalance.times(this.rewardPerMPHPerSecond).times(this.constants.DAY_IN_SEC);

    this.claimableRewards = new BigNumber(await rewards.methods.earned(this.wallet.userAddress).call()).div(this.constants.PRECISION);

    this.mphPriceUSD = await this.helpers.getMPHPriceUSD();
    this.mphLPPriceUSD = await this.helpers.getMPHLPPriceUSD();
    const secondROI = this.totalRewardPerSecond.times(this.mphPriceUSD).div(this.totalStakedMPHBalance).times(100);
    this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
    this.monthlyROI = secondROI.times(this.constants.MONTH_IN_SEC);
    this.weeklyROI = secondROI.times(this.constants.WEEK_IN_SEC);
    this.dailyROI = secondROI.times(this.constants.DAY_IN_SEC);
  }

  resetData(): void {
    this.stakedMPHBalance = new BigNumber(0);
    this.stakedMPHPoolProportion = new BigNumber(0);
    this.claimableRewards = new BigNumber(0);
    this.totalStakedMPHBalance = new BigNumber(0);
    this.rewardPerMPHPerSecond = new BigNumber(0);
    this.rewardPerDay = new BigNumber(0);
    this.totalRewardPerSecond = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
    this.mphLPPriceUSD = new BigNumber(0);
    this.yearlyROI = new BigNumber(0);
    this.monthlyROI = new BigNumber(0);
    this.weeklyROI = new BigNumber(0);
    this.dailyROI = new BigNumber(0);
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeLPComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedMPHPoolProportion = this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance = this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerDay = this.rewardPerDay;
  }

  unstakeAndClaim() {
    const rewards = this.contract.getNamedContract('Farming');
    const func = rewards.methods.exit();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  claim() {
    const rewards = this.contract.getNamedContract('Farming');
    const func = rewards.methods.getReward();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected;
  }
}