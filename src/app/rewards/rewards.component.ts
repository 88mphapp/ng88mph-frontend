import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';
import { DataService } from '../data.service';
import { ModalUnstakeComponent } from './modal-unstake/modal-unstake.component';
import { request, gql } from 'graphql-request';

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.component.html',
  styleUrls: ['./rewards.component.css'],
})
export class RewardsComponent implements OnInit {
  stakeAmount: BigNumber;
  xMPHBalance: BigNumber;
  stakedMPHBalance: BigNumber;
  unstakedMPHBalance: BigNumber;
  tokenAllowance: BigNumber;

  mphPriceUSD: BigNumber;
  xMPHPriceUSD: BigNumber;
  xMPHTotalSupply: BigNumber;
  pricePerFullShare: BigNumber;
  yearlyROI: BigNumber;

  distributionEndTime: string;
  daysToNextDistribution: number;
  protocolFeesUSD: BigNumber;
  compRewardsToken: BigNumber;
  compRewardsUSD: BigNumber;
  farmRewardsToken: BigNumber;
  farmRewardsUSD: BigNumber;
  stkaaveRewardsToken: BigNumber;
  stkaaveRewardsUSD: BigNumber;
  totalRewardsUSD: BigNumber;
  maxAPY: BigNumber;

  constructor(
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService,
    public datas: DataService
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
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData(true, true);
      this.loadData(true, true);
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const mph = this.contract.getNamedContract('MPHToken', readonlyWeb3);
    let address = this.wallet.actualAddress.toLowerCase();

    if (loadUser && address) {
      const queryString = gql`
        {
          mphholder (
            id: "${address}"
          ) {
            id
            mphBalance
            xmphBalance
            mphStaked
          }
        }
      `;
      request(
        this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[this.wallet.networkID],
        queryString
      ).then((data: QueryResult) => {
        this.stakedMPHBalance = new BigNumber(data.mphholder.mphStaked);
        this.unstakedMPHBalance = new BigNumber(data.mphholder.mphBalance);
        this.xMPHBalance = new BigNumber(data.mphholder.xmphBalance);

        this.setStakeAmount(this.unstakedMPHBalance.toFixed(18));
      });

      mph.methods
        .allowance(address, this.constants.XMPH_ADDRESS[this.wallet.networkID])
        .call()
        .then((allowance) => {
          this.tokenAllowance = new BigNumber(allowance).div(
            this.constants.PRECISION
          );
        });
    }

    if (loadGlobal) {
      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();

      const queryString = gql`
        {
          xMPH(id: "0") {
            totalSupply
            pricePerFullShare
            currentUnlockEndTimestamp
            lastRewardTimestamp
            lastRewardAmount
          }
        }
      `;
      request(
        this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[this.wallet.networkID],
        queryString
      ).then((data: QueryResult) => {
        this.pricePerFullShare = new BigNumber(data.xMPH.pricePerFullShare);
        this.xMPHPriceUSD = this.pricePerFullShare.times(this.mphPriceUSD);
        this.xMPHTotalSupply = new BigNumber(data.xMPH.totalSupply);
        this.distributionEndTime = new Date(
          parseInt(data.xMPH.currentUnlockEndTimestamp) * 1e3
        ).toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        });
        const daysToNextDistribution: number = Math.ceil(
          (parseInt(data.xMPH.currentUnlockEndTimestamp) - Date.now() / 1e3) /
            this.constants.DAY_IN_SEC
        );
        daysToNextDistribution > 0
          ? (this.daysToNextDistribution = daysToNextDistribution)
          : (this.daysToNextDistribution = 0);

        const rewardsEndDate = new BigNumber(
          data.xMPH.currentUnlockEndTimestamp
        );
        const rewardsStartDate = new BigNumber(data.xMPH.lastRewardTimestamp);
        const rewardsAmount = new BigNumber(data.xMPH.lastRewardAmount);
        const rewardPerSecond = rewardsAmount
          .div(rewardsEndDate.minus(rewardsStartDate))
          .times(this.mphPriceUSD);
        let secondROI = rewardPerSecond
          .div(this.xMPHTotalSupply.times(this.xMPHPriceUSD))
          .times(100);
        if (secondROI.isNaN()) {
          secondROI = new BigNumber(0);
        }
        this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
      });

      // load reward accumulation stats -- only available on mainnet
      if (this.wallet.networkID == this.constants.CHAIN_ID.MAINNET) {
        this.loadRewardAccumulationStats();
      }

      this.maxAPY = await this.datas.getMaxAPY();
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.stakeAmount = new BigNumber(0);
      this.stakedMPHBalance = new BigNumber(0);
      this.unstakedMPHBalance = new BigNumber(0);
      this.xMPHBalance = new BigNumber(0);
      this.tokenAllowance = new BigNumber(0);
    }

    if (resetGlobal) {
      this.xMPHTotalSupply = new BigNumber(0);
      this.pricePerFullShare = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
      this.xMPHPriceUSD = new BigNumber(0);
      this.yearlyROI = new BigNumber(0);
      this.protocolFeesUSD = new BigNumber(0);
      this.compRewardsToken = new BigNumber(0);
      this.compRewardsUSD = new BigNumber(0);
      this.farmRewardsToken = new BigNumber(0);
      this.farmRewardsUSD = new BigNumber(0);
      this.stkaaveRewardsToken = new BigNumber(0);
      this.stkaaveRewardsUSD = new BigNumber(0);
      this.totalRewardsUSD = new BigNumber(0);
      this.maxAPY = new BigNumber(0);
      this.daysToNextDistribution = 0;
    }
  }

  async loadRewardAccumulationStats() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();

    // compute protocol fees for v2
    const allPoolsV2 = this.contract.getPoolInfoList(true);
    let protocolFeesUSDV2 = new BigNumber(0);
    let countedStablecoinMapV2 = {};
    Promise.all(
      allPoolsV2.map(async (poolInfo) => {
        if (countedStablecoinMapV2[poolInfo.stablecoinSymbol]) {
          return;
        }
        countedStablecoinMapV2[poolInfo.stablecoinSymbol] = true;
        const poolStablecoin = this.contract.getContract(
          poolInfo.stablecoin,
          'ERC20',
          readonlyWeb3
        );
        const poolFeesToken = new BigNumber(
          await poolStablecoin.methods
            .balanceOf(this.constants.DUMPER_V2)
            .call()
        ).div(Math.pow(10, poolInfo.stablecoinDecimals));
        const stablecoinPrice = await this.helpers.getTokenPriceUSD(
          poolInfo.stablecoin,
          this.wallet.networkID
        );
        protocolFeesUSDV2 = protocolFeesUSDV2.plus(
          poolFeesToken.times(stablecoinPrice)
        );
      })
    ).then(() => {
      this.protocolFeesUSD = this.protocolFeesUSD.plus(protocolFeesUSDV2);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(protocolFeesUSDV2);
    });

    // compute protocol fees for v3
    const allPools = this.contract.getPoolInfoList();
    let protocolFeesUSD = new BigNumber(0);
    let countedStablecoinMap = {};
    Promise.all(
      allPools.map(async (poolInfo) => {
        if (countedStablecoinMap[poolInfo.stablecoinSymbol]) {
          return;
        }
        countedStablecoinMap[poolInfo.stablecoinSymbol] = true;
        const poolStablecoin = this.contract.getContract(
          poolInfo.stablecoin,
          'ERC20',
          readonlyWeb3
        );
        const poolFeesToken = new BigNumber(
          await poolStablecoin.methods
            .balanceOf(this.constants.DUMPER_V3)
            .call()
        ).div(Math.pow(10, poolInfo.stablecoinDecimals));
        const stablecoinPrice = await this.helpers.getTokenPriceUSD(
          poolInfo.stablecoin,
          this.wallet.networkID
        );
        protocolFeesUSD = protocolFeesUSD.plus(
          poolFeesToken.times(stablecoinPrice)
        );
      })
    ).then(() => {
      this.protocolFeesUSD = this.protocolFeesUSD.plus(protocolFeesUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(protocolFeesUSD);
    });

    // compute stkAAVE rewards
    // @notice 1 AAVE = 1 stkAAVE, so price will be the same
    const aavePools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Aave'
    );
    const aaveDataProvider = this.contract.getNamedContract(
      'AaveProtocolDataProvider',
      readonlyWeb3
    );
    const stkaaveController = this.contract.getNamedContract(
      'StakedAaveController',
      readonlyWeb3
    );
    const stkaaveToken = this.contract.getERC20(
      this.constants.STKAAVE[this.wallet.networkID],
      readonlyWeb3
    );

    let aTokens: Array<string> = [];
    const aTokenData = await aaveDataProvider.methods.getAllATokens().call();
    for (let token in aTokenData) {
      aTokens.push(aTokenData[token].tokenAddress);
    }

    let stkaaveRewardsToken = new BigNumber(0);
    Promise.all(
      aavePools.map(async (poolInfo) => {
        const rewardUnclaimed = new BigNumber(
          await stkaaveController.methods
            .getRewardsBalance(aTokens, poolInfo.moneyMarket)
            .call()
        ).div(this.constants.PRECISION);
        const rewardClaimed = new BigNumber(
          await stkaaveToken.methods.balanceOf(poolInfo.moneyMarket).call()
        ).div(this.constants.PRECISION);
        stkaaveRewardsToken = stkaaveRewardsToken
          .plus(rewardUnclaimed)
          .plus(rewardClaimed);
      })
    ).then(async () => {
      const rewardInDumper = new BigNumber(
        await stkaaveToken.methods.balanceOf(this.constants.DUMPER_V3).call()
      ).div(this.constants.PRECISION);
      stkaaveRewardsToken = stkaaveRewardsToken.plus(rewardInDumper);

      this.stkaaveRewardsToken = stkaaveRewardsToken;
      const stkaavePriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.AAVE[this.wallet.networkID],
        this.wallet.networkID
      );
      this.stkaaveRewardsUSD = stkaaveRewardsToken.times(stkaavePriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        stkaaveRewardsToken.times(stkaavePriceUSD)
      );
    });

    // compute COMP rewards for v3
    const compoundPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Compound'
    );
    const compoundLens = this.contract.getNamedContract(
      'CompoundLens',
      readonlyWeb3
    );
    const compToken = this.contract.getERC20(
      this.constants.COMP[this.wallet.networkID],
      readonlyWeb3
    );
    let compRewardsToken = new BigNumber(0);
    Promise.all(
      compoundPools.map(async (poolInfo) => {
        const rewardUnclaimed = new BigNumber(
          (
            await compoundLens.methods
              .getCompBalanceMetadataExt(
                this.constants.COMP[this.wallet.networkID],
                this.constants.COMPOUND_COMPTROLLER,
                poolInfo.moneyMarket
              )
              .call()
          ).allocated
        ).div(this.constants.PRECISION);
        const rewardClaimed = new BigNumber(
          await compToken.methods.balanceOf(poolInfo.moneyMarket).call()
        ).div(this.constants.PRECISION);
        compRewardsToken = compRewardsToken
          .plus(rewardUnclaimed)
          .plus(rewardClaimed);
      })
    ).then(async () => {
      const rewardInDumper = new BigNumber(
        await compToken.methods.balanceOf(this.constants.DUMPER_V3).call()
      ).div(this.constants.PRECISION);
      compRewardsToken = compRewardsToken.plus(rewardInDumper);

      this.compRewardsToken = this.compRewardsToken.plus(compRewardsToken);
      const compPriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.COMP[this.wallet.networkID],
        this.wallet.networkID
      );
      this.compRewardsUSD = compRewardsToken.times(compPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        compRewardsToken.times(compPriceUSD)
      );
    });

    // compute COMP rewards for v2
    const compoundPoolsV2 = allPoolsV2.filter(
      (poolInfo) => poolInfo.protocol === 'Compound'
    );
    let compRewardsTokenV2 = new BigNumber(0);
    Promise.all(
      compoundPoolsV2.map(async (poolInfo) => {
        const rewardUnclaimed = new BigNumber(
          (
            await compoundLens.methods
              .getCompBalanceMetadataExt(
                this.constants.COMP[this.wallet.networkID],
                this.constants.COMPOUND_COMPTROLLER,
                poolInfo.moneyMarket
              )
              .call()
          ).allocated
        ).div(this.constants.PRECISION);
        const rewardClaimed = new BigNumber(
          await compToken.methods.balanceOf(poolInfo.moneyMarket).call()
        ).div(this.constants.PRECISION);
        compRewardsTokenV2 = compRewardsTokenV2
          .plus(rewardUnclaimed)
          .plus(rewardClaimed);
      })
    ).then(async () => {
      const rewardInDumper = new BigNumber(
        await compToken.methods.balanceOf(this.constants.DUMPER_V2).call()
      ).div(this.constants.PRECISION);
      compRewardsTokenV2 = compRewardsTokenV2.plus(rewardInDumper);

      this.compRewardsToken = this.compRewardsToken.plus(compRewardsTokenV2);
      const compPriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.COMP[this.wallet.networkID],
        this.wallet.networkID
      );
      this.compRewardsUSD = compRewardsTokenV2.times(compPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        compRewardsTokenV2.times(compPriceUSD)
      );
    });

    // compute FARM rewards for v3
    const harvestPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Harvest'
    );
    const farmToken = this.contract.getERC20(
      this.constants.FARM[this.wallet.networkID],
      readonlyWeb3
    );
    let farmRewardsToken = new BigNumber(0);
    Promise.all(
      harvestPools.map(async (poolInfo) => {
        const stakingPool = this.contract.getRewards(
          poolInfo.stakingPool,
          readonlyWeb3
        );
        const rewardUnclaimed = new BigNumber(
          await stakingPool.methods.earned(poolInfo.moneyMarket).call()
        ).div(this.constants.PRECISION);
        farmRewardsToken = farmRewardsToken.plus(rewardUnclaimed);
      })
    ).then(async () => {
      const rewardInDumper = new BigNumber(
        await farmToken.methods.balanceOf(this.constants.DUMPER_V3).call()
      ).div(this.constants.PRECISION);
      farmRewardsToken = farmRewardsToken.plus(rewardInDumper);

      this.farmRewardsToken = this.farmRewardsToken.plus(farmRewardsToken);
      const farmPriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.FARM[this.wallet.networkID],
        this.wallet.networkID
      );
      this.farmRewardsUSD = farmRewardsToken.times(farmPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        farmRewardsToken.times(farmPriceUSD)
      );
    });

    // compute FARM rewards for v2
    const harvestPoolsV2 = allPoolsV2.filter(
      (poolInfo) => poolInfo.protocol === 'Harvest'
    );
    let farmRewardsTokenV2 = new BigNumber(0);
    Promise.all(
      harvestPoolsV2.map(async (poolInfo) => {
        const stakingPool = this.contract.getRewards(
          poolInfo.stakingPool,
          readonlyWeb3
        );
        const rewardUnclaimed = new BigNumber(
          await stakingPool.methods.earned(poolInfo.moneyMarket).call()
        ).div(this.constants.PRECISION);
        farmRewardsTokenV2 = farmRewardsTokenV2.plus(rewardUnclaimed);
      })
    ).then(async () => {
      const rewardInDumper = new BigNumber(
        await farmToken.methods.balanceOf(this.constants.DUMPER_V2).call()
      ).div(this.constants.PRECISION);
      farmRewardsTokenV2 = farmRewardsTokenV2.plus(rewardInDumper);

      this.farmRewardsToken = this.farmRewardsToken.plus(farmRewardsTokenV2);
      const farmPriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.FARM[this.wallet.networkID],
        this.wallet.networkID
      );
      this.farmRewardsUSD = farmRewardsTokenV2.times(farmPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        farmRewardsTokenV2.times(farmPriceUSD)
      );
    });
  }

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.xMPHBalance = this.xMPHBalance;
    modalRef.componentInstance.xMPHTotalSupply = this.xMPHTotalSupply;
    modalRef.componentInstance.pricePerFullShare = this.pricePerFullShare;
  }

  setStakeAmount(amount: number | string) {
    this.stakeAmount = new BigNumber(amount);
    if (this.stakeAmount.isNaN()) {
      this.stakeAmount = new BigNumber(0);
    }
  }

  stake() {
    const mph = this.contract.getNamedContract('MPHToken');
    const xmph = this.contract.getNamedContract('xMPH');
    const stakeAmount = this.helpers.processWeb3Number(
      this.stakeAmount.times(this.constants.PRECISION)
    );
    const func = xmph.methods.deposit(stakeAmount);

    this.wallet.sendTxWithToken(
      func,
      mph,
      xmph.options.address,
      stakeAmount,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  approve() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const mph = this.contract.getNamedContract('MPHToken', readonlyWeb3);
    const xmph = this.contract.getNamedContract('xMPH', readonlyWeb3);
    const userAddress: string = this.wallet.actualAddress;
    const stakeAmount = this.helpers.processWeb3Number(
      this.stakeAmount.times(this.constants.PRECISION)
    );

    this.wallet.approveToken(
      mph,
      xmph.options.address,
      stakeAmount,
      () => {},
      () => {},
      async () => {
        this.tokenAllowance = new BigNumber(
          await mph.methods.allowance(userAddress, xmph.options.address).call()
        ).div(this.constants.PRECISION);
      },
      (error) => {
        this.wallet.displayGenericError(error);
      },
      true
    );
  }

  canStake(): boolean {
    return (
      this.wallet.connected &&
      this.stakeAmount.gt(0) &&
      this.unstakedMPHBalance.gte(this.stakeAmount)
    );
  }

  canUnstake(): boolean {
    return this.wallet.connected && this.xMPHBalance.gt(0);
  }
}

interface QueryResult {
  mphholder: {
    id: string;
    mphBalance: string;
    xmphBalance: string;
    mphStaked: string;
  };
  xMPH: {
    totalSupply: string;
    pricePerFullShare: string;
    currentUnlockEndTimestamp: string;
    lastRewardTimestamp: string;
    lastRewardAmount: string;
  };
}
