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
  // user
  stakeAmount: BigNumber;
  xMPHBalance: BigNumber;
  stakedMPHBalance: BigNumber;
  unstakedMPHBalance: BigNumber;
  tokenAllowance: BigNumber;
  xMPHPriceUSD: BigNumber;
  xMPHTotalSupply: BigNumber;
  pricePerFullShare: BigNumber;
  yearlyROI: BigNumber;
  daysToNextDistribution: number;
  protocolFeesUSD: BigNumber;
  totalRewardsUSD: BigNumber;
  maxAPY: BigNumber;

  // reward tokens
  compRewardsToken: BigNumber; // Ethereum
  stkaaveRewardsToken: BigNumber; // Ethereum
  farmRewardsToken: BigNumber; // Ethereum
  screamRewards: BigNumber; // Fantom
  geistRewards: BigNumber; // Fantom

  // reward tokens USD
  compRewardsUSD: BigNumber; // Ethereum
  stkaaveRewardsUSD: BigNumber; // Ethereum
  farmRewardsUSD: BigNumber; // Ethereum
  screamRewardsUSD: BigNumber; // Fantom
  geistRewardsUSD: BigNumber; // Fantom

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
    this.loadData(
      this.wallet.connected || this.wallet.watching,
      true,
      this.wallet.networkID
    );

    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false, this.wallet.networkID);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData(true, true);
      this.loadData(true, true, networkID);
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.resetData(true, false);
      this.loadData(true, false, this.wallet.networkID);
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true, this.wallet.networkID);
    });
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
      this.xMPHPriceUSD = new BigNumber(0);
      this.yearlyROI = new BigNumber(0);
      this.protocolFeesUSD = new BigNumber(0);
      this.totalRewardsUSD = new BigNumber(0);
      this.maxAPY = new BigNumber(0);
      this.daysToNextDistribution = 0;

      // reward tokens
      this.compRewardsToken = new BigNumber(0); // Ethereum
      this.stkaaveRewardsToken = new BigNumber(0); // Ethereum
      this.farmRewardsToken = new BigNumber(0); // Ethereum
      this.screamRewards = new BigNumber(0); // Fantom
      this.geistRewards = new BigNumber(0); // Fantom

      // reward tokens USD
      this.compRewardsUSD = new BigNumber(0); // Ethereum
      this.stkaaveRewardsUSD = new BigNumber(0); // Ethereum
      this.farmRewardsUSD = new BigNumber(0); // Ethereum
      this.screamRewardsUSD = new BigNumber(0); // Fantom
      this.geistRewardsUSD = new BigNumber(0); // Fantom
    }
  }

  async loadData(loadUser: boolean, loadGlobal: boolean, networkID: number) {
    // @notice wait 1 second (configurable) before loading data
    // @dev timeout prevents bug when loading page from non-ethereum chain
    await setTimeout(async () => {
      if (networkID !== this.wallet.networkID) {
        return;
      }

      const web3 = this.wallet.httpsWeb3(networkID);
      const mph = this.contract.getNamedContract('MPHToken', web3);
      const xmph = this.contract.getNamedContract('xMPH', web3);
      const user = this.wallet.actualAddress.toLowerCase();

      if (loadUser && user) {
        mph.methods
          .balanceOf(user)
          .call()
          .then((balance) => {
            this.unstakedMPHBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
            this.setStakeAmount(this.unstakedMPHBalance.toFixed(18));
          });

        mph.methods
          .allowance(user, this.constants.XMPH_ADDRESS[networkID])
          .call()
          .then((allowance) => {
            this.tokenAllowance = new BigNumber(allowance).div(
              this.constants.PRECISION
            );
          });

        xmph.methods
          .balanceOf(user)
          .call()
          .then((balance) => {
            this.xMPHBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });

        if (networkID === this.constants.CHAIN_ID.MAINNET) {
          const queryString = gql`
            {
              mphholder (
                id: "${user}"
              ) {
                mphStaked
              }
            }
          `;
          request(
            this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[networkID],
            queryString
          ).then((data: QueryResult) => {
            this.stakedMPHBalance = new BigNumber(data.mphholder.mphStaked);
          });
        }
      }

      if (loadGlobal) {
        xmph.methods
          .getPricePerFullShare()
          .call()
          .then((result) => {
            this.pricePerFullShare = new BigNumber(result).div(
              this.constants.PRECISION
            );
            this.xMPHPriceUSD = this.pricePerFullShare.times(
              this.datas.mphPriceUSD
            );
          });

        xmph.methods
          .totalSupply()
          .call()
          .then((result) => {
            this.xMPHTotalSupply = new BigNumber(result).div(
              this.constants.PRECISION
            );
          });

        let rewardsStartDate: BigNumber;
        await xmph.methods
          .lastRewardTimestamp()
          .call()
          .then((result) => {
            rewardsStartDate = new BigNumber(result);
          });

        let rewardsEndDate: BigNumber;
        await xmph.methods
          .currentUnlockEndTimestamp()
          .call()
          .then((result) => {
            const daysToNextDistribution: number = Math.ceil(
              (parseInt(result) - Date.now() / 1e3) / this.constants.DAY_IN_SEC
            );
            daysToNextDistribution > 0
              ? (this.daysToNextDistribution = daysToNextDistribution)
              : (this.daysToNextDistribution = 0);
            rewardsEndDate = new BigNumber(result);
          });

        let rewardsAmount: BigNumber;
        await xmph.methods
          .lastRewardAmount()
          .call()
          .then((result) => {
            rewardsAmount = new BigNumber(result).div(this.constants.PRECISION);
          });

        let rewardPerSecond = rewardsAmount
          .div(rewardsEndDate.minus(rewardsStartDate))
          .times(this.datas.mphPriceUSD);
        if (rewardPerSecond.isNaN()) {
          rewardPerSecond = new BigNumber(0);
        }

        let secondROI = rewardPerSecond
          .div(this.xMPHTotalSupply.times(this.xMPHPriceUSD))
          .times(100);
        if (secondROI.isNaN()) {
          secondROI = new BigNumber(0);
        }

        this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
        this.loadRewardAccumulationStats(networkID);
        this.maxAPY = await this.datas.getMaxAPY();
      }
    }, 1000);
  }

  loadRewardAccumulationStats(networkID: number) {
    if (networkID !== this.wallet.networkID) {
      return;
    }

    switch (networkID) {
      case this.constants.CHAIN_ID.MAINNET:
        this.getProtocolFees(networkID);
        this.getAaveRewards(networkID);
        this.getCompoundRewards(networkID);
        this.getHarvestRewards(networkID);
        // @dev bprotocol rewards need implemented
        // @dev cream rewards need implemented
        break;
      case this.constants.CHAIN_ID.POLYGON:
        console.log('Polygon rewards not yet implemented');
        break;
      case this.constants.CHAIN_ID.AVALANCHE:
        console.log('Avalanche rewards not yet implemented');
        break;
      case this.constants.CHAIN_ID.FANTOM:
        this.getProtocolFees(networkID);
        this.getGeistRewards(networkID);
        this.getScreamRewards(networkID);
        break;
    }
  }

  async getProtocolFees(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const allPools = this.contract.getPoolInfoList(networkID);

    let countedStablecoinMap = {};
    let protocolFeesUSD = new BigNumber(0);

    // @notice on non-Ethereum chains, the fee beneficiary is the gov treasury address
    let dumper: string;
    switch (networkID) {
      case this.constants.CHAIN_ID.MAINNET:
        dumper = this.constants.DUMPER_V3;
        break;
      case this.constants.CHAIN_ID.POLYGON:
        break;
      case this.constants.CHAIN_ID.AVALANCHE:
        break;
      case this.constants.CHAIN_ID.FANTOM:
        dumper = this.constants.GOV_TREASURY[networkID];
        break;
    }

    Promise.all(
      allPools.map(async (poolInfo) => {
        if (countedStablecoinMap[poolInfo.stablecoinSymbol]) {
          return;
        }
        countedStablecoinMap[poolInfo.stablecoinSymbol] = true;
        const poolStablecoin = this.contract.getContract(
          poolInfo.stablecoin,
          'ERC20',
          web3
        );
        const poolFeesToken = new BigNumber(
          await poolStablecoin.methods.balanceOf(dumper).call()
        ).div(Math.pow(10, poolInfo.stablecoinDecimals));
        const stablecoinPrice = await this.datas.getAssetPriceUSD(
          poolInfo.stablecoin,
          networkID
        );
        protocolFeesUSD = protocolFeesUSD.plus(
          poolFeesToken.times(stablecoinPrice)
        );
      })
    ).then(() => {
      this.protocolFeesUSD = this.protocolFeesUSD.plus(protocolFeesUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(protocolFeesUSD);
    });
  }

  async getAaveRewards(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const aaveDataProvider = this.contract.getNamedContract(
      'AaveProtocolDataProvider',
      web3,
      networkID
    );
    const stkaaveController = this.contract.getNamedContract(
      'StakedAaveController',
      web3,
      networkID
    );
    const stkaaveToken = this.contract.getERC20(
      this.constants.STKAAVE[networkID],
      web3
    );

    let aTokens: string[] = [];
    const aTokenData = await aaveDataProvider.methods.getAllATokens().call();
    for (let token in aTokenData) {
      aTokens.push(aTokenData[token].tokenAddress);
    }

    const allPools = this.contract.getPoolInfoList(networkID);
    const aavePools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Aave'
    );

    let stkaaveRewardsToken = new BigNumber(0);
    Promise.all(
      aavePools.map(async (poolInfo) => {
        // unclaimed rewards
        await stkaaveController.methods
          .getRewardsBalance(aTokens, poolInfo.moneyMarket)
          .call()
          .then((result) => {
            const rewardUnclaimed = new BigNumber(result).div(
              this.constants.PRECISION
            );
            stkaaveRewardsToken = stkaaveRewardsToken.plus(rewardUnclaimed);
          });

        // claimed rewards
        await stkaaveToken.methods
          .balanceOf(poolInfo.moneyMarket)
          .call()
          .then((result) => {
            const rewardClaimed = new BigNumber(result).div(
              this.constants.PRECISION
            );
            stkaaveRewardsToken = stkaaveRewardsToken.plus(rewardClaimed);
          });
      })
    ).then(async () => {
      // reward in dumper
      await stkaaveToken.methods
        .balanceOf(this.constants.DUMPER_V3)
        .call()
        .then((result) => {
          const rewardInDumper = new BigNumber(result).div(
            this.constants.PRECISION
          );
          stkaaveRewardsToken = stkaaveRewardsToken.plus(rewardInDumper);
        });

      const stkaavePriceUSD = await this.datas.getAssetPriceUSD(
        this.constants.AAVE[networkID],
        networkID
      );
      this.stkaaveRewardsToken = stkaaveRewardsToken;
      this.stkaaveRewardsUSD = stkaaveRewardsToken.times(stkaavePriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(this.stkaaveRewardsUSD);
    });
  }

  async getCompoundRewards(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const compoundLens = this.contract.getNamedContract(
      'CompoundLens',
      web3,
      networkID
    );
    const compToken = this.contract.getERC20(
      this.constants.COMP[networkID],
      web3
    );

    const allPoolsV2 = this.contract.getPoolInfoList(networkID, true);
    const allPoolsV3 = this.contract.getPoolInfoList(networkID);
    const allPools = allPoolsV2.concat(allPoolsV3);
    const compoundPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Compound'
    );

    let compRewardsToken: BigNumber = new BigNumber(0);
    Promise.all(
      compoundPools.map(async (poolInfo) => {
        // unclaimed rewards
        await compoundLens.methods
          .getCompBalanceMetadataExt(
            this.constants.COMP[networkID],
            this.constants.COMPOUND_COMPTROLLER,
            poolInfo.moneyMarket
          )
          .call()
          .then((result) => {
            const rewardUnclaimed = new BigNumber(result.allocated).div(
              this.constants.PRECISION
            );
            compRewardsToken = compRewardsToken.plus(rewardUnclaimed);
          });

        // claimed rewards
        await compToken.methods
          .balanceOf(poolInfo.moneyMarket)
          .call()
          .then((result) => {
            const rewardClaimed = new BigNumber(result).div(
              this.constants.PRECISION
            );
            compRewardsToken = compRewardsToken.plus(rewardClaimed);
          });
      })
    ).then(async () => {
      // reward in dumper
      await compToken.methods
        .balanceOf(this.constants.DUMPER_V3)
        .call()
        .then((result) => {
          const rewardInDumper = new BigNumber(result).div(
            this.constants.PRECISION
          );
          compRewardsToken = compRewardsToken.plus(rewardInDumper);
        });

      const compPriceUSD = await this.datas.getAssetPriceUSD(
        this.constants.COMP[networkID],
        networkID
      );
      this.compRewardsToken = this.compRewardsToken.plus(compRewardsToken);
      this.compRewardsUSD = compRewardsToken.times(compPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(this.compRewardsUSD);
    });
  }

  async getHarvestRewards(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const farmToken = this.contract.getERC20(
      this.constants.FARM[networkID],
      web3
    );

    const allPoolsV2 = this.contract.getPoolInfoList(networkID, true);
    const allPoolsV3 = this.contract.getPoolInfoList(networkID);
    const allPools = allPoolsV2.concat(allPoolsV3);
    const harvestPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Harvest'
    );

    let farmRewardsToken: BigNumber = new BigNumber(0);
    Promise.all(
      harvestPools.map(async (poolInfo) => {
        // unclaimed rewards
        const stakingPool = this.contract.getContract(
          poolInfo.stakingPool,
          'Rewards',
          web3
        );
        await stakingPool.methods
          .earned(poolInfo.moneyMarket)
          .call()
          .then((result) => {
            const rewardUnclaimed = new BigNumber(result).div(
              this.constants.PRECISION
            );
            farmRewardsToken = farmRewardsToken.plus(rewardUnclaimed);
          });

        // claimed rewards
        await farmToken.methods
          .balanceOf(poolInfo.moneyMarket)
          .call()
          .then((result) => {
            const rewardClaimed = new BigNumber(result).div(
              this.constants.PRECISION
            );
            farmRewardsToken = farmRewardsToken.plus(rewardClaimed);
          });
      })
    ).then(async () => {
      // reward in dumper
      await farmToken.methods
        .balanceOf(this.constants.DUMPER_V3)
        .call()
        .then((result) => {
          const rewardInDumper = new BigNumber(result).div(
            this.constants.PRECISION
          );
          farmRewardsToken = farmRewardsToken.plus(rewardInDumper);
        });

      const farmPriceUSD = await this.datas.getAssetPriceUSD(
        this.constants.FARM[networkID],
        networkID
      );
      this.farmRewardsToken = this.farmRewardsToken.plus(farmRewardsToken);
      this.farmRewardsUSD = farmRewardsToken.times(farmPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(this.farmRewardsUSD);
    });
  }

  async getGeistRewards(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const geistDataProvider = this.contract.getNamedContract(
      'GeistProtocolDataProvider',
      web3,
      networkID
    );
    const geistController = this.contract.getNamedContract(
      'GeistController',
      web3,
      networkID
    );
    const geistVest = this.contract.getNamedContract(
      'GeistVest',
      web3,
      networkID
    );
    const geistToken = this.contract.getERC20(
      this.constants.GEIST[networkID],
      web3
    );

    let gTokens: string[] = [];
    const gTokensData = await geistDataProvider.methods.getAllATokens().call();
    for (let token in gTokensData) {
      gTokens.push(gTokensData[token].tokenAddress);
    }

    const allPools = this.contract.getPoolInfoList(networkID);
    const geistPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Geist'
    );

    let geistRewards: BigNumber = new BigNumber(0);
    Promise.all(
      geistPools.map(async (poolInfo) => {
        // unclaimed rewards
        await geistController.methods
          .claimableReward(poolInfo.moneyMarket, gTokens)
          .call()
          .then((result) => {
            for (let x in result) {
              const rewardUnclaimed = new BigNumber(result[x]).div(
                this.constants.PRECISION
              );
              geistRewards = geistRewards.plus(rewardUnclaimed);
            }
          });
      })
    ).then(async () => {
      // vesting rewards
      // @dev this needs to be confirmed
      await geistVest.methods
        .totalBalance(this.constants.GOV_TREASURY[networkID])
        .call()
        .then((result) => {
          const rewardVesting = new BigNumber(result).div(
            this.constants.PRECISION
          );
          geistRewards = geistRewards.plus(rewardVesting);
        });

      // claimed rewards
      await geistToken.methods
        .balanceOf(this.constants.GOV_TREASURY[networkID])
        .call()
        .then((result) => {
          const rewardClaimed = new BigNumber(result).div(
            this.constants.PRECISION
          );
          geistRewards = geistRewards.plus(rewardClaimed);
        });

      const geistPriceUSD = await this.datas.getAssetPriceUSD(
        this.constants.GEIST[networkID],
        networkID
      );
      this.geistRewards = geistRewards;
      this.geistRewardsUSD = geistRewards.times(geistPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(this.geistRewardsUSD);
    });
  }

  async getScreamRewards(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const screamLens = this.contract.getNamedContract(
      'ScreamLens',
      web3,
      networkID
    );
    const screamToken = this.contract.getERC20(
      this.constants.SCREAM[networkID],
      web3
    );

    const allPools = this.contract.getPoolInfoList(networkID);
    const screamPools = allPools.filter(
      (poolInfo) => poolInfo.protocol === 'Scream'
    );

    let screamRewards: BigNumber = new BigNumber(0);
    Promise.all(
      screamPools.map(async (poolInfo) => {
        // unclaimed rewards
        // @dev needs to be checked, currently returns 0 for all pools
        await screamLens.methods
          .getCompBalanceMetadataExt(
            this.constants.SCREAM[networkID],
            this.constants.SCREAM_COMPTROLLER,
            poolInfo.moneyMarket
          )
          .call()
          .then((result) => {
            const rewardUnclaimed = new BigNumber(result.allocated).div(
              this.constants.PRECISION
            );
            screamRewards = screamRewards.plus(rewardUnclaimed);
          });

        // claimed rewards
        await screamToken.methods
          .balanceOf(poolInfo.moneyMarket)
          .call()
          .then((result) => {
            const rewardClaimed = new BigNumber(result).div(
              this.constants.PRECISION
            );
            screamRewards = screamRewards.plus(rewardClaimed);
          });
      })
    ).then(async () => {
      // reward in dumper
      await screamToken.methods
        .balanceOf(this.constants.GOV_TREASURY[networkID])
        .call()
        .then((result) => {
          const rewardInDumper = new BigNumber(result).div(
            this.constants.PRECISION
          );
          screamRewards = screamRewards.plus(rewardInDumper);
        });

      const screamPriceUSD = await this.datas.getAssetPriceUSD(
        this.constants.SCREAM[networkID],
        networkID
      );
      this.screamRewards = screamRewards;
      this.screamRewardsUSD = screamRewards.times(screamPriceUSD);
      this.totalRewardsUSD = this.totalRewardsUSD.plus(this.screamRewardsUSD);
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
    const web3 = this.wallet.readonlyWeb3();
    const mph = this.contract.getNamedContract('MPHToken', web3);
    const xmph = this.contract.getNamedContract('xMPH', web3);
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
    const web3 = this.wallet.readonlyWeb3();
    const mph = this.contract.getNamedContract('MPHToken', web3);
    const xmph = this.contract.getNamedContract('xMPH', web3);
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
