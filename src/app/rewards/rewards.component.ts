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

  stakeAmount: BigNumber;
  unstakedMPHBalance: BigNumber;
  xMPHBalance: BigNumber;
  xMPHTotalSupply: BigNumber;

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
  distributionEndTime: string;
  yearlyROI: BigNumber;
  monthlyROI: BigNumber;
  weeklyROI: BigNumber;
  dailyROI: BigNumber;
  mphPriceUSD: BigNumber;
  xMPHPriceUSD: BigNumber;
  protocolFeesUSD: BigNumber;
  compRewardsToken: BigNumber;
  compRewardsUSD: BigNumber;
  farmRewardsToken: BigNumber;
  farmRewardsUSD: BigNumber;
  stkaaveRewardsToken: BigNumber;
  stkaaveRewardsUSD: BigNumber;
  totalRewardsUSD: BigNumber;

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
    const mph = this.contract.getNamedContract('MPHToken', readonlyWeb3);
    const xmph = this.contract.getNamedContract('xMPHToken', readonlyWeb3);

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

      mph.methods.balanceOf(this.wallet.userAddress).call().then(unstakedMPHBalance => {
        this.unstakedMPHBalance = new BigNumber(unstakedMPHBalance).div(this.constants.PRECISION);
        this.setStakeAmount(this.unstakedMPHBalance.toFixed(18));
      });

      xmph.methods.balanceOf(this.wallet.userAddress).call().then(xMPHBalance => {
        this.xMPHBalance = new BigNumber(xMPHBalance).div(this.constants.PRECISION);
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

      mph.methods.balanceOf(this.wallet.watchedAddress).call().then(unstakedMPHBalance => {
        this.unstakedMPHBalance = new BigNumber(unstakedMPHBalance).div(this.constants.PRECISION);
      });

      xmph.methods.balanceOf(this.wallet.watchedAddress).call().then(xMPHBalance => {
        this.xMPHBalance = new BigNumber(xMPHBalance).div(this.constants.PRECISION);
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

      // @dev placeholder - delete once xMPH contract has been deployed on mainnet
      this.distributionEndTime = new Date(1625346438 * 1e3).toLocaleString('en-US', {month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'});
      // @dev end placeholder

      // @dev uncomment once xMPH contract has been deployed on mainnet
      // xmph.methods.currentUnlockEndTimestamp().call().then(distributionEndTime => {
      //   this.distributionEndTime = new Date(distributionEndTime * 1e3).toLocaleString('en-US', {month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'});
      // });

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

      // @dev xMPH needs to be listed on coingecko in order for this to work
      this.xMPHPriceUSD = new BigNumber(await this.helpers.getTokenPriceUSD(this.constants.XMPH));

      xmph.methods.totalSupply().call().then(xMPHTotalSupply => {
        this.xMPHTotalSupply = new BigNumber(xMPHTotalSupply).div(this.constants.PRECISION);
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
      this.stakeAmount = new BigNumber(0);
      this.unstakedMPHBalance = new BigNumber(0);
      this.xMPHBalance = new BigNumber(0);
      this.stakedMPHBalance = new BigNumber(0);
      this.stakedMPHPoolProportion = new BigNumber(0);
      this.claimableRewards = new BigNumber(0);
    }

    if (resetGlobal) {
      this.xMPHTotalSupply = new BigNumber(0);
      this.totalStakedMPHBalance = new BigNumber(0);
      this.rewardPerMPHPerSecond = new BigNumber(0);
      this.rewardPerWeek = new BigNumber(0);
      this.totalRewardPerSecond = new BigNumber(0);
      this.totalHistoricalReward = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
      this.xMPHPriceUSD = new BigNumber(0);
      this.yearlyROI = new BigNumber(0);
      this.monthlyROI = new BigNumber(0);
      this.weeklyROI = new BigNumber(0);
      this.dailyROI = new BigNumber(0);
      this.protocolFeesUSD = new BigNumber(0);
      this.compRewardsToken = new BigNumber(0);
      this.compRewardsUSD = new BigNumber(0);
      this.farmRewardsToken = new BigNumber(0);
      this.farmRewardsUSD = new BigNumber(0);
      this.stkaaveRewardsToken = new BigNumber(0);
      this.stkaaveRewardsUSD = new BigNumber(0);
      this.totalRewardsUSD = new BigNumber(0);
    }
  }

  async loadRewardAccumulationStats() {
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
      this.totalRewardsUSD = this.totalRewardsUSD.plus(protocolFeesUSD);
    });

    // compute stkAAVE rewards
    // @dev confirm poolInfo.address is correct vs poolInfo.moneyMarket once v3 is live
    // @notice 1 AAVE = 1 stkAAVE, so price will be the same
    const aavePools = allPools.filter(poolInfo => poolInfo.protocol === 'Aave');
    const aaveDataProvider = this.contract.getNamedContract('AaveProtocolDataProvider', readonlyWeb3);
    const stkaaveController = this.contract.getNamedContract('StakedAaveController', readonlyWeb3);
    const stkaaveToken = this.contract.getERC20(this.constants.STKAAVE, readonlyWeb3);

    let aTokens: Array<string> = [];
    const aTokenData = await aaveDataProvider.methods.getAllATokens().call();
    for (let token in aTokenData) {
      aTokens.push(aTokenData[token].tokenAddress);
    }

    let stkaaveRewardsToken = new BigNumber(0);
    Promise.all(aavePools.map(async poolInfo => {
      const rewardUnclaimed = new BigNumber(await stkaaveController.methods.getRewardsBalance(aTokens, poolInfo.address).call()).div(this.constants.PRECISION);
      const rewardClaimed = new BigNumber(await stkaaveToken.methods.balanceOf(poolInfo.address).call()).div(this.constants.PRECISION);
      stkaaveRewardsToken = stkaaveRewardsToken.plus(rewardUnclaimed).plus(rewardClaimed);
    })).then(async () => {
      const rewardInDumper = new BigNumber(await stkaaveToken.methods.balanceOf(this.constants.DUMPER).call()).div(this.constants.PRECISION);
      stkaaveRewardsToken = stkaaveRewardsToken.plus(rewardInDumper);

      this.stkaaveRewardsToken = stkaaveRewardsToken;
      const stkaavePriceUSD = await this.helpers.getTokenPriceUSD(this.constants.AAVE); // 1 aave = 1 stkaave
      this.stkaaveRewardsUSD = stkaaveRewardsToken.times(stkaavePriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(stkaaveRewardsToken.times(stkaavePriceUSD));
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
      this.totalRewardsUSD = this.totalRewardsUSD.plus(compRewardsToken.times(compPriceUSD));
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
      this.totalRewardsUSD = this.totalRewardsUSD.plus(farmRewardsToken.times(farmPriceUSD));
    });

  }

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.xMPHBalance = this.xMPHBalance;
    modalRef.componentInstance.xMPHTotalSupply = this.xMPHTotalSupply;
  }

  setStakeAmount(amount: number | string) {
    this.stakeAmount = new BigNumber(amount);
    if (this.stakeAmount.isNaN()) {
      this.stakeAmount = new BigNumber(0);
    }
  }

  // @dev update assets/abis/xMPHToken.json to correct ABI for xMPH
  // @dev update assets/json/contracts.json to correct address for xMPH
  // @dev update constants.service.ts to correct address for xMPH
  // @dev needs testing once xMPH contract has been deployed on mainnet
  stake() {
    const mph = this.contract.getNamedContract('MPHToken');
    const xmph = this.contract.getNamedContract('xMPHToken');
    const stakeAmount = this.helpers.processWeb3Number(this.stakeAmount.times(this.constants.PRECISION));
    const func = xmph.methods.deposit(stakeAmount);

    this.wallet.sendTxWithToken(func, mph, xmph.options.address, stakeAmount, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  canStake(): boolean {
    return this.wallet.connected && this.unstakedMPHBalance.gte(this.stakeAmount) && this.stakeAmount.gt(0);
  }

  canUnstake(): boolean {
    return this.wallet.connected && this.xMPHBalance.gt(0);
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
