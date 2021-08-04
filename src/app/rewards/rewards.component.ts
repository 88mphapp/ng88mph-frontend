import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';
import { DataService } from '../data.service';
import { ModalUnstakeComponent } from './modal-unstake/modal-unstake.component';

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.component.html',
  styleUrls: ['./rewards.component.css'],
})
export class RewardsComponent implements OnInit {
  PERIOD = 7; // 7 days

  stakeAmount: BigNumber;
  xMPHBalance: BigNumber;
  unstakedMPHBalance: BigNumber;
  tokenAllowance: BigNumber;

  mphPriceUSD: BigNumber;
  xMPHPriceUSD: BigNumber;
  xMPHTotalSupply: BigNumber;
  pricePerFullShare: BigNumber;
  yearlyROI: BigNumber;

  distributionEndTime: string;
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
    const xmph = this.contract.getNamedContract('xMPH', readonlyWeb3);

    let address = this.wallet.actualAddress;

    if (loadUser && address) {
      mph.methods
        .balanceOf(address)
        .call()
        .then((unstakedMPHBalance) => {
          this.unstakedMPHBalance = new BigNumber(unstakedMPHBalance).div(
            this.constants.PRECISION
          );
          this.setStakeAmount(this.unstakedMPHBalance.toFixed(18));
        });

      mph.methods
        .allowance(address, xmph.options.address)
        .call()
        .then((allowance) => {
          this.tokenAllowance = new BigNumber(allowance).div(
            this.constants.PRECISION
          );
        });

      xmph.methods
        .balanceOf(address)
        .call()
        .then((xMPHBalance) => {
          this.xMPHBalance = new BigNumber(xMPHBalance).div(
            this.constants.PRECISION
          );
        });
    }

    if (loadGlobal) {
      this.maxAPY = await this.datas.getMaxAPY();

      // load reward accumulation stats
      // only available on mainnet
      if (this.wallet.networkID == this.constants.CHAIN_ID.MAINNET) {
        this.loadRewardAccumulationStats();
      }

      // load MPH and xMPH data
      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();

      xmph.methods
        .getPricePerFullShare()
        .call()
        .then((pricePerFullShare) => {
          this.pricePerFullShare = new BigNumber(pricePerFullShare).div(
            this.constants.PRECISION
          );
          this.xMPHPriceUSD = this.pricePerFullShare.times(this.mphPriceUSD);
        });

      xmph.methods
        .totalSupply()
        .call()
        .then((xMPHTotalSupply) => {
          this.xMPHTotalSupply = new BigNumber(xMPHTotalSupply).div(
            this.constants.PRECISION
          );
        });

      // load distribution end date
      xmph.methods
        .currentUnlockEndTimestamp()
        .call()
        .then((distributionEndTime) => {
          this.distributionEndTime = new Date(
            distributionEndTime * 1e3
          ).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          });
        });

      // load xMPH rewards data
      const rewardsEndDate = new BigNumber(
        await xmph.methods.currentUnlockEndTimestamp().call()
      );
      const rewardsStartDate = new BigNumber(
        await xmph.methods.lastRewardTimestamp().call()
      );
      const rewardsAmount = new BigNumber(
        await xmph.methods.lastRewardAmount().call()
      ).div(this.constants.PRECISION);
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
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.stakeAmount = new BigNumber(0);
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
    }
  }

  async loadRewardAccumulationStats() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();

    // compute protocol fees
    const allPools = this.contract.getPoolInfoList();
    let protocolFeesUSD = new BigNumber(0);
    let countedStablecoinMap = {};
    Promise.all(
      allPools.map(async (poolInfo) => {
        if (countedStablecoinMap[poolInfo.stablecoinSymbol]) {
          return;
        }
        countedStablecoinMap[poolInfo.stablecoinSymbol] = true;
        const poolStablecoin = this.contract.getPoolStablecoin(
          poolInfo.name,
          readonlyWeb3
        );
        const poolFeesToken = new BigNumber(
          await poolStablecoin.methods.balanceOf(this.constants.DUMPER).call()
        ).div(Math.pow(10, poolInfo.stablecoinDecimals));
        const stablecoinPrice = await this.helpers.getTokenPriceUSD(
          poolInfo.stablecoin
        );
        protocolFeesUSD = protocolFeesUSD.plus(
          poolFeesToken.times(stablecoinPrice)
        );
      })
    ).then(() => {
      this.protocolFeesUSD = protocolFeesUSD;
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
      this.constants.STKAAVE,
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
            .getRewardsBalance(aTokens, poolInfo.address)
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
        await stkaaveToken.methods.balanceOf(this.constants.DUMPER).call()
      ).div(this.constants.PRECISION);
      stkaaveRewardsToken = stkaaveRewardsToken.plus(rewardInDumper);

      this.stkaaveRewardsToken = stkaaveRewardsToken;
      const stkaavePriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.AAVE
      );
      this.stkaaveRewardsUSD = stkaaveRewardsToken.times(stkaavePriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        stkaaveRewardsToken.times(stkaavePriceUSD)
      );
    });

    // compute COMP rewards

    const compoundPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Compound'
    );
    const compoundLens = this.contract.getNamedContract(
      'CompoundLens',
      readonlyWeb3
    );
    const compToken = this.contract.getERC20(this.constants.COMP, readonlyWeb3);
    let compRewardsToken = new BigNumber(0);
    Promise.all(
      compoundPools.map(async (poolInfo) => {
        const rewardUnclaimed = new BigNumber(
          (
            await compoundLens.methods
              .getCompBalanceMetadataExt(
                this.constants.COMP,
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
        await compToken.methods.balanceOf(this.constants.DUMPER).call()
      ).div(this.constants.PRECISION);
      compRewardsToken = compRewardsToken.plus(rewardInDumper);

      this.compRewardsToken = compRewardsToken;
      const compPriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.COMP
      );
      this.compRewardsUSD = compRewardsToken.times(compPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        compRewardsToken.times(compPriceUSD)
      );
    });

    // compute FARM rewards
    const harvestPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Harvest'
    );
    const farmToken = this.contract.getERC20(this.constants.FARM, readonlyWeb3);
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
        await farmToken.methods.balanceOf(this.constants.DUMPER).call()
      ).div(this.constants.PRECISION);
      farmRewardsToken = farmRewardsToken.plus(rewardInDumper);

      this.farmRewardsToken = farmRewardsToken;
      const farmPriceUSD = await this.helpers.getTokenPriceUSD(
        this.constants.FARM
      );
      this.farmRewardsUSD = farmRewardsToken.times(farmPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(
        farmRewardsToken.times(farmPriceUSD)
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
