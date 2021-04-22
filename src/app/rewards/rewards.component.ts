import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { ModalStakeComponent } from './modal-stake/modal-stake.component';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';
import { ModalUnstakeComponent } from './modal-unstake/modal-unstake.component';

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.component.html',
  styleUrls: ['./rewards.component.css']
})
export class RewardsComponent implements OnInit {
  PERIOD = 7; // 7 days

  stakedMPHBalance: BigNumber;
  stakedMPHPoolProportion: BigNumber;
  claimableRewards: BigNumber;
  rewardPerWeek: BigNumber;
  totalRewardPerSecond: BigNumber;
  rewardPerMPHPerSecond: BigNumber;
  totalStakedMPHBalance: BigNumber;
  totalHistoricalReward: BigNumber;
  rewardStartTime: string;
  rewardEndTime: string;
  yearlyROI: BigNumber;
  monthlyROI: BigNumber;
  weeklyROI: BigNumber;
  dailyROI: BigNumber;
  mphPriceUSD: BigNumber;
  protocolFeesUSD: BigNumber;
  compRewardsToken: BigNumber;
  compRewardsUSD: BigNumber;
  farmRewardsToken: BigNumber;
  farmRewardsUSD: BigNumber;

  constructor(
    private apollo: Apollo,
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected || this.wallet.watching, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    if (loadGlobal) {
      const queryString = gql`
      {
        mph(id: "0") {
          id
          rewardPerMPHPerSecond
          rewardPerSecond
          totalHistoricalReward
        }
      }
    `;
      this.apollo.query<QueryResult>({
        query: queryString
      }).subscribe((x) => this.handleData(x));
    }

    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const rewards = this.contract.getNamedContract('Rewards', readonlyWeb3);

    if (this.wallet.connected && loadUser && !this.wallet.watching) {
      rewards.methods.balanceOf(this.wallet.userAddress).call().then(async stakeBalance => {
        this.stakedMPHBalance = new BigNumber(stakeBalance).div(this.constants.PRECISION);
        const totalStakedMPHBalance = new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION);
        this.stakedMPHPoolProportion = this.stakedMPHBalance.div(totalStakedMPHBalance).times(100);
        if (this.stakedMPHPoolProportion.isNaN()) {
          this.stakedMPHPoolProportion = new BigNumber(0);
        }
        const weekInSeconds = 7 * 24 * 60 * 60;
        this.rewardPerWeek = this.stakedMPHBalance.times(this.rewardPerMPHPerSecond).times(weekInSeconds);
      });

      rewards.methods.earned(this.wallet.userAddress).call().then(claimableRewards => {
        this.claimableRewards = new BigNumber(claimableRewards).div(this.constants.PRECISION);
      });
    }

    if (loadUser && this.wallet.watching) {
      rewards.methods.balanceOf(this.wallet.watchedAddress).call().then(async stakeBalance => {
        this.stakedMPHBalance = new BigNumber(stakeBalance).div(this.constants.PRECISION);
        const totalStakedMPHBalance = new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION);
        this.stakedMPHPoolProportion = this.stakedMPHBalance.div(totalStakedMPHBalance).times(100);
        if (this.stakedMPHPoolProportion.isNaN()) {
          this.stakedMPHPoolProportion = new BigNumber(0);
        }
        const weekInSeconds = 7 * 24 * 60 * 60;
        this.rewardPerWeek = this.stakedMPHBalance.times(this.rewardPerMPHPerSecond).times(weekInSeconds);
      });

      rewards.methods.earned(this.wallet.watchedAddress).call().then(claimableRewards => {
        this.claimableRewards = new BigNumber(claimableRewards).div(this.constants.PRECISION);
      });
    }

    if (loadGlobal) {
      // load reward accumulation stats
      this.loadRewardAccumulationStats();

      // load reward start & end time
      rewards.methods.periodFinish().call().then(endTime => {
        this.rewardStartTime = new Date((+endTime - this.PERIOD * 24 * 60 * 60) * 1e3).toLocaleString();
        this.rewardEndTime = new Date(+endTime * 1e3).toLocaleString();
      });

      rewards.methods.totalSupply().call().then(async totalSupply => {
        this.totalStakedMPHBalance = new BigNumber(totalSupply).div(this.constants.PRECISION);
        this.mphPriceUSD = await this.helpers.getMPHPriceUSD();
        let secondROI = this.totalRewardPerSecond.div(this.totalStakedMPHBalance.times(this.mphPriceUSD)).times(100);
        if (secondROI.isNaN()) {
          secondROI = new BigNumber(0);
        }
        this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
        this.monthlyROI = secondROI.times(this.constants.MONTH_IN_SEC);
        this.weeklyROI = secondROI.times(this.constants.WEEK_IN_SEC);
        this.dailyROI = secondROI.times(this.constants.DAY_IN_SEC);
      });
    }
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const mph = queryResult.data.mph;
      if (mph) {
        this.rewardPerMPHPerSecond = new BigNumber(mph.rewardPerMPHPerSecond);
        this.totalRewardPerSecond = new BigNumber(mph.rewardPerSecond);
        this.totalHistoricalReward = new BigNumber(mph.totalHistoricalReward);
      }
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.stakedMPHBalance = new BigNumber(0);
      this.stakedMPHPoolProportion = new BigNumber(0);
      this.claimableRewards = new BigNumber(0);
    }

    if (resetGlobal) {
      this.totalStakedMPHBalance = new BigNumber(0);
      this.rewardPerMPHPerSecond = new BigNumber(0);
      this.rewardPerWeek = new BigNumber(0);
      this.totalRewardPerSecond = new BigNumber(0);
      this.totalHistoricalReward = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
      this.yearlyROI = new BigNumber(0);
      this.monthlyROI = new BigNumber(0);
      this.weeklyROI = new BigNumber(0);
      this.dailyROI = new BigNumber(0);
      this.protocolFeesUSD = new BigNumber(0);
      this.compRewardsToken = new BigNumber(0);
      this.compRewardsUSD = new BigNumber(0);
      this.farmRewardsToken = new BigNumber(0);
      this.farmRewardsUSD = new BigNumber(0);
    }
  }

  loadRewardAccumulationStats() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();

    // compute protocol fees
    const allPools = this.contract.getPoolInfoList();
    let protocolFeesUSD = new BigNumber(0);
    let countedStablecoinMap = {};
    Promise.all(allPools.map(async poolInfo => {
      if (countedStablecoinMap[poolInfo.stablecoinSymbol]) {
        return;
      }
      countedStablecoinMap[poolInfo.stablecoinSymbol] = true;
      const poolStablecoin = this.contract.getPoolStablecoin(poolInfo.name, readonlyWeb3);
      const poolFeesToken = new BigNumber(await poolStablecoin.methods.balanceOf(this.constants.DUMPER).call()).div(Math.pow(10, poolInfo.stablecoinDecimals));
      const stablecoinPrice = await this.helpers.getTokenPriceUSD(poolInfo.stablecoin);
      protocolFeesUSD = protocolFeesUSD.plus(poolFeesToken.times(stablecoinPrice));
    })).then(() => {
      this.protocolFeesUSD = protocolFeesUSD;
    });

    // compute COMP rewards
    const compoundPools = allPools.filter(poolInfo => poolInfo.protocol === 'Compound');
    const compoundLens = this.contract.getNamedContract('CompoundLens', readonlyWeb3);
    const compToken = this.contract.getERC20(this.constants.COMP, readonlyWeb3);
    let compRewardsToken = new BigNumber(0);
    Promise.all(compoundPools.map(async poolInfo => {
      const rewardUnclaimed = new BigNumber((await compoundLens.methods.getCompBalanceMetadataExt(this.constants.COMP, this.constants.COMPOUND_COMPTROLLER, poolInfo.moneyMarket).call()).allocated).div(this.constants.PRECISION);
      const rewardClaimed = new BigNumber(await compToken.methods.balanceOf(poolInfo.moneyMarket).call()).div(this.constants.PRECISION);
      compRewardsToken = compRewardsToken.plus(rewardUnclaimed).plus(rewardClaimed);
    })).then(async () => {
      const rewardInDumper = new BigNumber(await compToken.methods.balanceOf(this.constants.DUMPER).call()).div(this.constants.PRECISION);
      compRewardsToken = compRewardsToken.plus(rewardInDumper);

      this.compRewardsToken = compRewardsToken;
      const compPriceUSD = await this.helpers.getTokenPriceUSD(this.constants.COMP);
      this.compRewardsUSD = compRewardsToken.times(compPriceUSD);
    });

    // compute FARM rewards
    const harvestPools = allPools.filter(poolInfo => poolInfo.protocol === 'Harvest');
    const farmToken = this.contract.getERC20(this.constants.FARM, readonlyWeb3);
    let farmRewardsToken = new BigNumber(0);
    Promise.all(harvestPools.map(async poolInfo => {
      const stakingPool = this.contract.getRewards(poolInfo.stakingPool, readonlyWeb3);
      const rewardUnclaimed = new BigNumber(await stakingPool.methods.earned(poolInfo.moneyMarket).call()).div(this.constants.PRECISION);
      farmRewardsToken = farmRewardsToken.plus(rewardUnclaimed);
    })).then(async () => {
      const rewardInDumper = new BigNumber(await farmToken.methods.balanceOf(this.constants.DUMPER).call()).div(this.constants.PRECISION);
      farmRewardsToken = farmRewardsToken.plus(rewardInDumper);

      this.farmRewardsToken = farmRewardsToken;
      const farmPriceUSD = await this.helpers.getTokenPriceUSD(this.constants.FARM);
      this.farmRewardsUSD = farmRewardsToken.times(farmPriceUSD);
    });
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedMPHPoolProportion = this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance = this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerWeek = this.rewardPerWeek;
  }

  openUntakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedMPHPoolProportion = this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance = this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerWeek = this.rewardPerWeek;
  }

  unstakeAndClaim() {
    const rewards = this.contract.getNamedContract('Rewards');
    const func = rewards.methods.exit();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  claim() {
    const rewards = this.contract.getNamedContract('Rewards');
    const func = rewards.methods.getReward();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected;
  }
}

interface QueryResult {
  mph: {
    id: string;
    rewardPerMPHPerSecond: number;
    rewardPerSecond: number;
    totalHistoricalReward: number;
  };
}
