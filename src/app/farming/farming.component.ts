import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { ModalStakeLPComponent } from './modal-stake-lp/modal-stake-lp.component';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';
import { ModalUnstakeLPComponent } from './modal-unstake-lp/modal-unstake-lp.component';

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
  rewardStartTime: string;
  rewardEndTime: string;

  sushiStakedLPBalance: BigNumber;
  sushiStakedLPPoolProportion: BigNumber;
  sushiClaimableRewards: BigNumber;
  sushiRewardPerDay: BigNumber;
  sushiTotalRewardPerSecond: BigNumber;
  sushiRewardPerLPPerSecond: BigNumber;
  sushiTotalStakedLPBalance: BigNumber;
  sushiPriceUSD: BigNumber;
  sushiLPPriceUSD: BigNumber;
  sushiYearlyROI: BigNumber;
  sushiMonthlyROI: BigNumber;
  sushiWeeklyROI: BigNumber;
  sushiDailyROI: BigNumber;

  yflinkStakedLPBalance: BigNumber;
  yflinkStakedLPPoolProportion: BigNumber;
  yflinkClaimableRewardsYFL: BigNumber;
  yflinkClaimableRewardsMPH: BigNumber;
  yflinkRewardPerDayYFL: BigNumber;
  yflinkRewardPerDayMPH: BigNumber;
  yflinkTotalRewardPerSecondMPH: BigNumber;
  yflinkTotalRewardPerSecondYFL: BigNumber;
  yflinkRewardPerLPPerSecondMPH: BigNumber;
  yflinkRewardPerLPPerSecondYFL: BigNumber;
  yflinkTotalStakedLPBalance: BigNumber;
  yflinkPriceUSD: BigNumber;
  yflinkLPPriceUSD: BigNumber;
  yflinkYearlyROI: BigNumber;
  yflinkMonthlyROI: BigNumber;
  yflinkWeeklyROI: BigNumber;
  yflinkDailyROI: BigNumber;

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
    const rewards = this.contract.getNamedContract('Farming', readonlyWeb3);

    const sushiMasterChef = this.contract.getContract(this.constants.SUSHI_MASTERCHEF, 'MasterChef', readonlyWeb3);
    const yflinkStaking = this.contract.getContract(this.constants.LINKSWAP_STAKING, 'LinkSwapStaking', readonlyWeb3);

    if (loadGlobal) {
      this.totalStakedMPHBalance = new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION);
      this.totalRewardPerSecond = new BigNumber(await rewards.methods.rewardRate().call()).div(this.constants.PRECISION);
      this.rewardPerMPHPerSecond = this.totalRewardPerSecond.div(this.totalStakedMPHBalance);
      if (this.totalStakedMPHBalance.isZero()) {
        this.rewardPerMPHPerSecond = new BigNumber(0);
      }
      // load reward start & end time
      rewards.methods.periodFinish().call().then(endTime => {
        this.rewardStartTime = new Date((+endTime - this.PERIOD * 24 * 60 * 60) * 1e3).toLocaleString();
        this.rewardEndTime = new Date(+endTime * 1e3).toLocaleString();
      });

      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();
      this.mphLPPriceUSD = await this.helpers.getMPHLPPriceUSD();
      const secondROI = this.totalRewardPerSecond.times(this.mphPriceUSD).div(this.totalStakedMPHBalance.times(this.mphLPPriceUSD)).times(100);
      this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
      this.monthlyROI = secondROI.times(this.constants.MONTH_IN_SEC);
      this.weeklyROI = secondROI.times(this.constants.WEEK_IN_SEC);
      this.dailyROI = secondROI.times(this.constants.DAY_IN_SEC);

      // sushi
      const sushiLPToken = this.contract.getERC20(this.constants.SUSHI_LP, readonlyWeb3);
      const sushiPoolInfo = await sushiMasterChef.methods.poolInfo(this.constants.SUSHI_MPH_ONSEN_ID).call();
      this.sushiTotalStakedLPBalance = new BigNumber(await sushiLPToken.methods.balanceOf(this.constants.SUSHI_MASTERCHEF).call()).div(this.constants.PRECISION);
      this.sushiTotalRewardPerSecond = new BigNumber(await sushiMasterChef.methods.sushiPerBlock().call()).div(5).div(this.constants.PRECISION).times(sushiPoolInfo.allocPoint).div(await sushiMasterChef.methods.totalAllocPoint().call());
      this.sushiRewardPerLPPerSecond = this.sushiTotalRewardPerSecond.div(this.sushiTotalStakedLPBalance);
      if (this.sushiTotalStakedLPBalance.isZero()) {
        this.sushiRewardPerLPPerSecond = new BigNumber(0);
      }
      this.sushiPriceUSD = new BigNumber(await this.helpers.getTokenPriceUSD(this.constants.SUSHI));
      this.sushiLPPriceUSD = await this.helpers.getLPPriceUSD(this.constants.SUSHI_LP);
      const sushiSecondROI = this.sushiTotalRewardPerSecond.times(this.sushiPriceUSD).div(this.sushiTotalStakedLPBalance.times(this.sushiLPPriceUSD)).times(100);
      this.sushiYearlyROI = sushiSecondROI.times(this.constants.YEAR_IN_SEC);
      this.sushiMonthlyROI = sushiSecondROI.times(this.constants.MONTH_IN_SEC);
      this.sushiWeeklyROI = sushiSecondROI.times(this.constants.WEEK_IN_SEC);
      this.sushiDailyROI = sushiSecondROI.times(this.constants.DAY_IN_SEC);

      // yflink
      this.yflinkTotalStakedLPBalance = new BigNumber(await yflinkStaking.methods.totalSupply().call()).div(this.constants.PRECISION);
      this.yflinkTotalRewardPerSecondYFL = new BigNumber(await yflinkStaking.methods.rewardRate(0).call()).div(this.constants.PRECISION);
      this.yflinkTotalRewardPerSecondMPH = new BigNumber(await yflinkStaking.methods.rewardRate(1).call()).div(this.constants.PRECISION);
      this.yflinkRewardPerLPPerSecondYFL = this.yflinkTotalRewardPerSecondYFL.div(this.yflinkTotalStakedLPBalance);
      this.yflinkRewardPerLPPerSecondMPH = this.yflinkTotalRewardPerSecondMPH.div(this.yflinkTotalStakedLPBalance);
      if (this.yflinkTotalStakedLPBalance.isZero()) {
        this.yflinkRewardPerLPPerSecondYFL = new BigNumber(0);
        this.yflinkRewardPerLPPerSecondMPH = new BigNumber(0);
      }
      this.yflinkPriceUSD = new BigNumber(await this.helpers.getTokenPriceUSD(this.constants.YFLINK));
      this.yflinkLPPriceUSD = await this.helpers.getLPPriceUSD(this.constants.LINKSWAP_LP);
      const yflinkSecondROI = this.yflinkTotalRewardPerSecondYFL.times(this.yflinkPriceUSD).plus(this.yflinkTotalRewardPerSecondMPH.times(this.mphPriceUSD)).div(this.yflinkTotalStakedLPBalance.times(this.yflinkLPPriceUSD)).times(100);
      this.yflinkYearlyROI = yflinkSecondROI.times(this.constants.YEAR_IN_SEC);
      this.yflinkMonthlyROI = yflinkSecondROI.times(this.constants.MONTH_IN_SEC);
      this.yflinkWeeklyROI = yflinkSecondROI.times(this.constants.WEEK_IN_SEC);
      this.yflinkDailyROI = yflinkSecondROI.times(this.constants.DAY_IN_SEC);
    }

    if (loadUser) {
      this.stakedMPHBalance = new BigNumber(await rewards.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
      this.claimableRewards = new BigNumber(await rewards.methods.earned(this.wallet.userAddress).call()).div(this.constants.PRECISION);
      this.stakedMPHPoolProportion = this.stakedMPHBalance.div(this.totalStakedMPHBalance).times(100);
      if (this.totalStakedMPHBalance.isZero()) {
        this.stakedMPHPoolProportion = new BigNumber(0);
      }
      this.rewardPerDay = this.stakedMPHBalance.times(this.rewardPerMPHPerSecond).times(this.constants.DAY_IN_SEC);

      // sushi
      const sushiUserInfo = await sushiMasterChef.methods.userInfo(this.constants.SUSHI_MPH_ONSEN_ID, this.wallet.userAddress).call();
      this.sushiStakedLPBalance = new BigNumber(sushiUserInfo.amount).div(this.constants.PRECISION);
      this.sushiClaimableRewards = new BigNumber(await sushiMasterChef.methods.pendingSushi(this.constants.SUSHI_MPH_ONSEN_ID, this.wallet.userAddress).call()).div(this.constants.PRECISION);
      this.sushiStakedLPPoolProportion = this.sushiStakedLPBalance.div(this.sushiTotalStakedLPBalance).times(100);
      if (this.sushiTotalStakedLPBalance.isZero()) {
        this.sushiStakedLPPoolProportion = new BigNumber(0);
      }
      this.sushiRewardPerDay = this.sushiStakedLPBalance.times(this.sushiRewardPerLPPerSecond).times(this.constants.DAY_IN_SEC);

      // yflink
      this.yflinkStakedLPBalance = new BigNumber(await yflinkStaking.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
      this.yflinkClaimableRewardsYFL = new BigNumber(await yflinkStaking.methods.earned(this.wallet.userAddress, 0).call()).div(this.constants.PRECISION);
      this.yflinkClaimableRewardsMPH = new BigNumber(await yflinkStaking.methods.earned(this.wallet.userAddress, 1).call()).div(this.constants.PRECISION);
      this.yflinkStakedLPPoolProportion = this.yflinkStakedLPBalance.div(this.yflinkTotalStakedLPBalance).times(100);
      if (this.yflinkTotalStakedLPBalance.isZero()) {
        this.yflinkStakedLPPoolProportion = new BigNumber(0);
      }
      this.yflinkRewardPerDayYFL = this.yflinkStakedLPBalance.times(this.yflinkRewardPerLPPerSecondYFL).times(this.constants.DAY_IN_SEC);
      this.yflinkRewardPerDayMPH = this.yflinkStakedLPBalance.times(this.yflinkRewardPerLPPerSecondMPH).times(this.constants.DAY_IN_SEC);
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.stakedMPHBalance = new BigNumber(0);
      this.stakedMPHPoolProportion = new BigNumber(0);
      this.claimableRewards = new BigNumber(0);
      this.rewardPerDay = new BigNumber(0);

      this.sushiStakedLPBalance = new BigNumber(0);
      this.sushiStakedLPPoolProportion = new BigNumber(0);
      this.sushiClaimableRewards = new BigNumber(0);
      this.sushiRewardPerDay = new BigNumber(0);

      this.yflinkStakedLPBalance = new BigNumber(0);
      this.yflinkStakedLPPoolProportion = new BigNumber(0);
      this.yflinkClaimableRewardsYFL = new BigNumber(0);
      this.yflinkClaimableRewardsMPH = new BigNumber(0);
      this.yflinkRewardPerDayYFL = new BigNumber(0);
      this.yflinkRewardPerDayMPH = new BigNumber(0);
    }

    if (resetGlobal) {
      this.totalStakedMPHBalance = new BigNumber(0);
      this.rewardPerMPHPerSecond = new BigNumber(0);
      this.totalRewardPerSecond = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
      this.mphLPPriceUSD = new BigNumber(0);
      this.yearlyROI = new BigNumber(0);
      this.monthlyROI = new BigNumber(0);
      this.weeklyROI = new BigNumber(0);
      this.dailyROI = new BigNumber(0);

      this.sushiTotalStakedLPBalance = new BigNumber(0);
      this.sushiRewardPerLPPerSecond = new BigNumber(0);
      this.sushiTotalRewardPerSecond = new BigNumber(0);
      this.sushiPriceUSD = new BigNumber(0);
      this.sushiLPPriceUSD = new BigNumber(0);
      this.sushiYearlyROI = new BigNumber(0);
      this.sushiMonthlyROI = new BigNumber(0);
      this.sushiWeeklyROI = new BigNumber(0);
      this.sushiDailyROI = new BigNumber(0);

      this.yflinkTotalRewardPerSecondMPH = new BigNumber(0);
      this.yflinkTotalRewardPerSecondYFL = new BigNumber(0);
      this.yflinkRewardPerLPPerSecondMPH = new BigNumber(0);
      this.yflinkRewardPerLPPerSecondYFL = new BigNumber(0);
      this.yflinkTotalStakedLPBalance = new BigNumber(0);
      this.yflinkPriceUSD = new BigNumber(0);
      this.yflinkLPPriceUSD = new BigNumber(0);
      this.yflinkYearlyROI = new BigNumber(0);
      this.yflinkMonthlyROI = new BigNumber(0);
      this.yflinkWeeklyROI = new BigNumber(0);
      this.yflinkDailyROI = new BigNumber(0);
    }
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeLPComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedMPHPoolProportion = this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance = this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerDay = this.rewardPerDay;
    modalRef.componentInstance.mphPriceUSD = this.mphPriceUSD;
  }

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeLPComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedMPHPoolProportion = this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance = this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerDay = this.rewardPerDay;
    modalRef.componentInstance.mphPriceUSD = this.mphPriceUSD;
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