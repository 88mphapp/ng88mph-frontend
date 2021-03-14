import { Component, Input, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ZeroCouponBondTableEntry } from '../../zero-coupon-bonds.component';
import { ModalStakeZCBLPComponent } from './modal-stake-zcblp/modal-stake-zcblp.component';
import { ModalUnstakeZCBLPComponent } from './modal-unstake-zcblp/modal-unstake-zcblp.component';

@Component({
  selector: 'app-farm-zero-coupon-bond',
  templateUrl: './farm-zero-coupon-bond.component.html',
  styleUrls: ['./farm-zero-coupon-bond.component.css']
})
export class FarmZeroCouponBondComponent implements OnInit {
  @Input() zcbEntry: ZeroCouponBondTableEntry;
  PERIOD = 42; // 42 days

  stakedTokenBalance: BigNumber;
  stakedTokenPoolProportion: BigNumber;
  claimableRewards: BigNumber;
  rewardPerDay: BigNumber;
  totalRewardPerSecond: BigNumber;
  rewardPerStakeTokenPerSecond: BigNumber;
  totalStakedTokenBalance: BigNumber;
  rewardTokenPriceUSD: BigNumber;
  stakeTokenPriceUSD: BigNumber;
  yearlyROI: BigNumber;
  monthlyROI: BigNumber;
  weeklyROI: BigNumber;
  dailyROI: BigNumber;
  rewardStartTime: string;
  rewardEndTime: string;

  constructor(
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const rewards = this.contract.getContract(this.zcbEntry.zcbInfo.farmAddress, 'Farming', readonlyWeb3);

    if (loadGlobal) {
      this.totalStakedTokenBalance = new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION);
      this.totalRewardPerSecond = new BigNumber(await rewards.methods.rewardRate().call()).div(this.constants.PRECISION);
      this.rewardPerStakeTokenPerSecond = this.totalRewardPerSecond.div(this.totalStakedTokenBalance);
      if (this.totalStakedTokenBalance.isZero()) {
        this.rewardPerStakeTokenPerSecond = new BigNumber(0);
      }
      // load reward start & end time
      rewards.methods.starttime().call().then(startTime => {
        this.rewardStartTime = new Date(+startTime * 1e3).toLocaleString();
        this.rewardEndTime = new Date((+startTime + this.PERIOD * this.constants.DAY_IN_SEC) * 1e3).toLocaleString();
      });

      this.rewardTokenPriceUSD = await this.helpers.getMPHPriceUSD();
      this.stakeTokenPriceUSD = await this.helpers.getZCBLPPriceUSD(this.zcbEntry.zcbInfo.sushiSwapPair, this.zcbEntry.zcbInfo.sushiSwapPairBaseTokenAddress);
      const secondROI = this.totalRewardPerSecond.times(this.rewardTokenPriceUSD).div(this.totalStakedTokenBalance.times(this.stakeTokenPriceUSD)).times(100);
      this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
      this.monthlyROI = secondROI.times(this.constants.MONTH_IN_SEC);
      this.weeklyROI = secondROI.times(this.constants.WEEK_IN_SEC);
      this.dailyROI = secondROI.times(this.constants.DAY_IN_SEC);
    }

    if (loadUser) {
      this.stakedTokenBalance = new BigNumber(await rewards.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
      this.claimableRewards = new BigNumber(await rewards.methods.earned(this.wallet.userAddress).call()).div(this.constants.PRECISION);
      this.stakedTokenPoolProportion = this.stakedTokenBalance.div(this.totalStakedTokenBalance).times(100);
      if (this.totalStakedTokenBalance.isZero()) {
        this.stakedTokenPoolProportion = new BigNumber(0);
      }
      this.rewardPerDay = this.stakedTokenBalance.times(this.rewardPerStakeTokenPerSecond).times(this.constants.DAY_IN_SEC);
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.stakedTokenBalance = new BigNumber(0);
      this.stakedTokenPoolProportion = new BigNumber(0);
      this.claimableRewards = new BigNumber(0);
      this.rewardPerDay = new BigNumber(0);
    }

    if (resetGlobal) {
      this.totalStakedTokenBalance = new BigNumber(0);
      this.rewardPerStakeTokenPerSecond = new BigNumber(0);
      this.totalRewardPerSecond = new BigNumber(0);
      this.rewardTokenPriceUSD = new BigNumber(0);
      this.stakeTokenPriceUSD = new BigNumber(0);
      this.yearlyROI = new BigNumber(0);
      this.monthlyROI = new BigNumber(0);
      this.weeklyROI = new BigNumber(0);
      this.dailyROI = new BigNumber(0);
    }
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeZCBLPComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedTokenPoolProportion = this.stakedTokenPoolProportion;
    modalRef.componentInstance.stakedTokenBalance = this.stakedTokenBalance;
    modalRef.componentInstance.totalStakedTokenBalance = this.totalStakedTokenBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerDay = this.rewardPerDay;
    modalRef.componentInstance.rewardTokenPriceUSD = this.rewardTokenPriceUSD;
    modalRef.componentInstance.zcbEntry = this.zcbEntry;
  }

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeZCBLPComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedTokenPoolProportion = this.stakedTokenPoolProportion;
    modalRef.componentInstance.stakedTokenBalance = this.stakedTokenBalance;
    modalRef.componentInstance.totalStakedTokenBalance = this.totalStakedTokenBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerDay = this.rewardPerDay;
    modalRef.componentInstance.rewardTokenPriceUSD = this.rewardTokenPriceUSD;
    modalRef.componentInstance.zcbEntry = this.zcbEntry;
  }

  unstakeAndClaim() {
    const rewards = this.contract.getContract(this.zcbEntry.zcbInfo.farmAddress, 'Farming');
    const func = rewards.methods.exit();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  claim() {
    const rewards = this.contract.getContract(this.zcbEntry.zcbInfo.farmAddress, 'Farming');
    const func = rewards.methods.getReward();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected;
  }
}
