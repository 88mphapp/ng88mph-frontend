import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { ModalDepositComponent } from './modal-deposit/modal-deposit.component';
import { ModalWithdrawComponent } from './modal-withdraw/modal-withdraw.component';
import { ModalMphRewardsComponent } from './modal-mph-rewards/modal-mph-rewards.component';
import { ModalTopUpComponent } from './modal-top-up/modal-top-up.component';
import { ModalRollOverComponent } from './modal-roll-over/modal-roll-over.component';
import { WalletService } from '../wallet.service';
import {
  ContractService,
  PoolInfo,
  ZeroCouponBondInfo,
} from '../contract.service';
import { DPool, UserPool, UserDeposit, UserZCBPool, Vest } from './types';
import { HelpersService } from '../helpers.service';
import { Timer } from '../timer';
import { ConstantsService } from '../constants.service';
import { DataService } from '../data.service';
import { ModalWithdrawZCBComponent } from './modal-withdraw-zcb/modal-withdraw-zcb.component';
import { ModalNftComponent } from './modal-nft/modal-nft.component';

@Component({
  selector: 'app-deposit',
  templateUrl: './deposit.component.html',
  styleUrls: ['./deposit.component.css'],
})
export class DepositComponent implements OnInit {
  DECIMALS = 2;

  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;
  totalMPHEarned: BigNumber;
  allPoolList: DPool[];
  allZCBPoolList: ZeroCouponBondInfo[];
  userPools: UserPool[];
  userZCBPools: UserZCBPool[];
  mphPriceUSD: BigNumber;

  // variables for get started section
  stepsCompleted: number;
  hasDeposit: boolean;
  claimedMPH: boolean;
  stakedMPH: boolean;

  constructor(
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    public datas: DataService,
    private router: Router
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
      setTimeout(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      }, this.constants.TX_CONFIRMATION_REFRESH_WAIT_TIME);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();

    let userID = this.wallet.actualAddress.toLowerCase();

    if (loadUser && userID) {
      // load xMPH balance for 'get started' section
      const xmph = this.contract.getNamedContract('xMPH', readonlyWeb3);
      xmph.methods
        .balanceOf(userID)
        .call()
        .then((xMPHBalance) => {
          if (new BigNumber(xMPHBalance).gt(0)) {
            this.stakedMPH = true;
            this.stepsCompleted += 1;
          }
        });

      // load Zero Coupon Bond / Preset Maturity data
      const zcbPoolNameList = this.contract.getZeroCouponBondPoolNameList();
      const zcbPoolList = zcbPoolNameList.map((poolName) =>
        this.contract.getZeroCouponBondPool(poolName)
      );
      this.allZCBPoolList = zcbPoolList.concat.apply([], zcbPoolList);
      const userZCBPools = [];
      let totalDepositUSD = new BigNumber(0);
      for (let zcbPool of this.allZCBPoolList) {
        const zcbContract = this.contract.getZeroCouponBondContract(
          zcbPool.address,
          readonlyWeb3
        );
        const poolInfo = this.contract.getPoolInfoFromAddress(
          await zcbContract.methods.pool().call()
        );
        const userBalance = new BigNumber(
          await zcbContract.methods.balanceOf(userID).call()
        ).div(Math.pow(10, poolInfo.stablecoinDecimals));

        if (userBalance.gt(this.constants.DUST_THRESHOLD)) {
          const zcbPriceUSD = new BigNumber(
            await this.getZeroCouponBondPriceUSD(zcbPool, poolInfo)
          );
          const userBalanceUSD = userBalance.times(zcbPriceUSD);
          const maturationTimestamp = await zcbContract.methods
            .maturationTimestamp()
            .call();
          const maturationDate = new Date(
            maturationTimestamp * 1e3
          ).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
          let userZCB: UserZCBPool = {
            zcbPoolInfo: zcbPool,
            poolInfo: poolInfo,
            amountToken: userBalance,
            amountUSD: userBalanceUSD,
            maturation: maturationDate,
            locked: +maturationTimestamp >= Date.now() / 1e3,
          };
          userZCBPools.push(userZCB);
          totalDepositUSD = totalDepositUSD.plus(userBalanceUSD);
        }
      }
      this.userZCBPools = userZCBPools;
      this.totalDepositUSD = totalDepositUSD;
    }

    await this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    const queryString = gql`
      {
        ${
          loadUser
            ? `user(id: "${userID}") {
              address
          pools {
            id
            address
            deposits(where: { user: "${userID}", amount_gt: "${this.constants.DUST_THRESHOLD}" }, orderBy: nftID) {
              nftID
              virtualTokenTotalSupply
              maturationTimestamp
              depositTimestamp
              interestRate
              feeRate
              amount
              vest {
                nftID
                owner
                lastUpdateTimestamp
                accumulatedAmount
                withdrawnAmount
                vestAmountPerStablecoinPerSecond
                totalExpectedMPHAmount
              }
            }
          }
          totalDepositByPool {
            pool {
              address
              stablecoin
            }
            totalDeposit
            totalInterestOwed
          }
        }`
            : ''
        }
        ${
          loadGlobal
            ? `dpools {
          id
          address
          totalDeposit
          poolDepositorRewardMintMultiplier
        }`
            : ''
        }
      }
    `;
    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => this.handleData(data));
  }

  async handleData(data: QueryResult) {
    const { user, dpools } = data;
    let stablecoinPriceCache = {};

    if (dpools) {
      let allPoolList = new Array<DPool>(0);
      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          // get MPH APR
          const mphDepositorRewardMintMultiplier = new BigNumber(
            pool.poolDepositorRewardMintMultiplier
          );
          const mphAPY = mphDepositorRewardMintMultiplier
            .times(this.mphPriceUSD)
            .times(this.constants.YEAR_IN_SEC)
            .div(stablecoinPrice)
            .times(100);

          const dpoolObj: DPool = {
            name: poolInfo.name,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            iconPath: poolInfo.iconPath,
            totalDepositToken: new BigNumber(pool.totalDeposit),
            totalDepositUSD: new BigNumber(pool.totalDeposit).times(
              stablecoinPrice
            ),
            maxAPY: await this.datas.getPoolMaxAPY(poolInfo.address),
            mphAPY: mphAPY,
            mphDepositorRewardMintMultiplier: mphDepositorRewardMintMultiplier,
          };
          allPoolList.push(dpoolObj);
        })
      ).then(() => {
        allPoolList.sort((a, b) => {
          const aName = a.name;
          const bName = b.name;
          if (aName > bName) {
            return 1;
          }
          if (aName < bName) {
            return -1;
          }
          return 0;
        });
        this.allPoolList = allPoolList;
      });
    }

    if (user) {
      let totalMPHEarned = new BigNumber(0);
      let totalClaimableMPH = new BigNumber(0);
      const vestingContract = this.contract.getNamedContract('Vesting02');

      // process user deposit list
      const userPools: UserPool[] = [];
      Promise.all(
        user.pools.map(async (pool) => {
          if (pool.deposits.length == 0) return;
          if (!this.hasDeposit) {
            this.hasDeposit = true;
            this.stepsCompleted += 1;
          }
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          let totalUserDepositsToken = new BigNumber(0);
          let totalUserDepositsUSD = new BigNumber(0);
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }
          const userPoolDeposits: Array<UserDeposit> = [];
          for (const deposit of pool.deposits) {
            // compute interest
            const depositAmount = new BigNumber(
              deposit.virtualTokenTotalSupply
            ).div(new BigNumber(deposit.interestRate).plus(1));
            const interestEarnedToken = new BigNumber(
              deposit.interestRate
            ).times(depositAmount);
            const interestEarnedUSD =
              interestEarnedToken.times(stablecoinPrice);

            // compute MPH APR
            let realMPHReward = new BigNumber(0);
            if (deposit.vest) {
              if (deposit.vest.owner !== user.address) {
                // vest NFT transferred to another account
                // reward is zero
                realMPHReward = new BigNumber(0);
              } else {
                // reward is given to deposit owner
                realMPHReward = new BigNumber(
                  deposit.vest.totalExpectedMPHAmount
                );
              }
              if (
                new BigNumber(deposit.vest.withdrawnAmount).gt(0) &&
                !this.claimedMPH
              ) {
                this.claimedMPH = true;
                this.stepsCompleted += 1;
              }
            }
            const mphAPY = realMPHReward
              .times(this.mphPriceUSD)
              .div(depositAmount)
              .div(stablecoinPrice)
              .div(+deposit.maturationTimestamp - +deposit.depositTimestamp)
              .times(this.constants.YEAR_IN_SEC)
              .times(100);
            totalMPHEarned = totalMPHEarned.plus(realMPHReward);

            let vest: Vest;
            if (deposit.vest) {
              vest = {
                nftID: +deposit.vest.nftID,
                lastUpdateTimestamp: +deposit.vest.lastUpdateTimestamp,
                accumulatedAmount: new BigNumber(
                  deposit.vest.accumulatedAmount
                ),
                withdrawnAmount: new BigNumber(deposit.vest.withdrawnAmount),
                vestAmountPerStablecoinPerSecond: new BigNumber(
                  deposit.vest.vestAmountPerStablecoinPerSecond
                ),
                totalExpectedMPHAmount: new BigNumber(
                  deposit.vest.totalExpectedMPHAmount
                ),
              };
            }

            // manually calculate claimableMPH
            let claimableMPH;
            const currentTimestamp = Math.min(
              Math.floor(Date.now() / 1e3),
              parseFloat(deposit.maturationTimestamp)
            );
            if (currentTimestamp < vest.lastUpdateTimestamp) {
              claimableMPH = vest.accumulatedAmount.minus(vest.withdrawnAmount);
            } else {
              claimableMPH = vest.accumulatedAmount
                .plus(
                  depositAmount
                    .times(currentTimestamp - vest.lastUpdateTimestamp)
                    .times(vest.vestAmountPerStablecoinPerSecond)
                )
                .minus(vest.withdrawnAmount);
            }

            // use contract call to fetch claimableMPH
            // let claimableMPH = new BigNumber(
            //   await vestingContract.methods
            //     .getVestWithdrawableAmount(deposit.vest.nftID)
            //     .call({from: this.wallet.actualAddress.toLowerCase()})
            // ).div(this.constants.PRECISION);

            totalClaimableMPH = totalClaimableMPH.plus(claimableMPH);

            const userPoolDeposit: UserDeposit = {
              nftID: +deposit.nftID,
              locked: +deposit.maturationTimestamp >= Date.now() / 1e3,
              amountToken: new BigNumber(depositAmount),
              amountUSD: new BigNumber(depositAmount).times(stablecoinPrice),
              apy: interestEarnedToken
                .div(depositAmount)
                .div(+deposit.maturationTimestamp - +deposit.depositTimestamp)
                .times(this.constants.YEAR_IN_SEC)
                .times(100),
              countdownTimer: new Timer(+deposit.maturationTimestamp, 'down'),
              interestEarnedToken,
              interestEarnedUSD,
              realMPHReward: realMPHReward,
              mphAPY: mphAPY,
              virtualTokenTotalSupply: new BigNumber(
                deposit.virtualTokenTotalSupply
              ),
              vest: vest,
              depositLength:
                +deposit.maturationTimestamp - +deposit.depositTimestamp,
              interestRate: interestEarnedToken
                .div(depositAmount)
                .div(+deposit.maturationTimestamp - +deposit.depositTimestamp)
                .times(this.constants.YEAR_IN_SEC)
                .times(100),
              maturationTimestamp: +deposit.maturationTimestamp,
            };
            userPoolDeposit.countdownTimer.start();
            userPoolDeposits.push(userPoolDeposit);
            totalUserDepositsToken = totalUserDepositsToken.plus(
              new BigNumber(depositAmount)
            );
            totalUserDepositsUSD = totalUserDepositsUSD.plus(
              new BigNumber(depositAmount).times(stablecoinPrice)
            );
          }

          // sort pool deposits by maturation timestamp
          userPoolDeposits.sort((a, b) => {
            return a.maturationTimestamp - b.maturationTimestamp;
          });

          const userPool: UserPool = {
            poolInfo: poolInfo,
            deposits: userPoolDeposits,
            totalUserDepositsToken: totalUserDepositsToken,
            totalUserDepositsUSD: totalUserDepositsUSD,
          };
          userPools.push(userPool);
        })
      ).then(() => {
        this.userPools = userPools;
        this.totalMPHEarned = totalClaimableMPH;
      });

      // compute total deposit & interest in USD
      let totalDepositUSD = new BigNumber(0);
      let totalInterestUSD = new BigNumber(0);
      Promise.all(
        user.totalDepositByPool.map(async (totalDepositEntity) => {
          let stablecoinPrice =
            stablecoinPriceCache[totalDepositEntity.pool.stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(
              totalDepositEntity.pool.stablecoin
            );
            stablecoinPriceCache[totalDepositEntity.pool.stablecoin] =
              stablecoinPrice;
          }

          const poolInfo = this.contract.getPoolInfoFromAddress(
            totalDepositEntity.pool.address
          );
          const activePool = this.allPoolList.find(
            (pool) => pool.name === poolInfo.name
          );
          const poolDeposit = new BigNumber(totalDepositEntity.totalDeposit);
          const poolDepositUSD = new BigNumber(
            totalDepositEntity.totalDeposit
          ).times(stablecoinPrice);
          const poolInterestUSD = new BigNumber(
            totalDepositEntity.totalInterestOwed
          ).times(stablecoinPrice);
          totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
          totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
        })
      ).then(() => {
        this.totalDepositUSD = this.totalDepositUSD.plus(totalDepositUSD);
        this.totalInterestUSD = totalInterestUSD;
      });
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.totalDepositUSD = new BigNumber(0);
      this.totalInterestUSD = new BigNumber(0);
      this.totalMPHEarned = new BigNumber(0);
      this.userPools = [];
      this.userZCBPools = [];
      this.stepsCompleted = 0;
      this.hasDeposit = false;
      this.claimedMPH = false;
      this.stakedMPH = false;
    }

    if (resetGlobal) {
      const allPoolList = new Array<DPool>(0);
      const poolInfoList = this.contract.getPoolInfoList();
      for (const poolInfo of poolInfoList) {
        const dpoolObj: DPool = {
          name: poolInfo.name,
          protocol: poolInfo.protocol,
          stablecoin: poolInfo.stablecoin,
          stablecoinSymbol: poolInfo.stablecoinSymbol,
          iconPath: poolInfo.iconPath,
          totalDepositToken: new BigNumber(0),
          totalDepositUSD: new BigNumber(0),
          maxAPY: new BigNumber(0),
          mphAPY: new BigNumber(0),
          mphDepositorRewardMintMultiplier: new BigNumber(0),
        };
        allPoolList.push(dpoolObj);
      }
      this.allPoolList = allPoolList;
      this.allPoolList = [];
      this.allZCBPoolList = [];
      this.mphPriceUSD = new BigNumber(0);
    }
  }

  async getZeroCouponBondPriceUSD(
    bond: ZeroCouponBondInfo,
    pool: PoolInfo
  ): Promise<BigNumber> {
    return new BigNumber(await this.helpers.getTokenPriceUSD(pool.stablecoin));
  }

  openDepositModal(poolName?: string) {
    const modalRef = this.modalService.open(ModalDepositComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.defaultPoolName = poolName;
  }

  openWithdrawModal(userDeposit: UserDeposit, poolInfo: PoolInfo) {
    const modalRef = this.modalService.open(ModalWithdrawComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.userDeposit = userDeposit;
    modalRef.componentInstance.poolInfo = poolInfo;
  }

  openWithdrawZCBModal(userZCBPool: UserZCBPool) {
    const modalRef = this.modalService.open(ModalWithdrawZCBComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.userZCBPool = userZCBPool;
  }

  openRewardsModal(userDeposit: UserDeposit) {
    const modalRef = this.modalService.open(ModalMphRewardsComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.userDeposit = userDeposit;
  }

  openTopUpModal(userDeposit: UserDeposit, poolInfo: PoolInfo) {
    const modalRef = this.modalService.open(ModalTopUpComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.userDeposit = userDeposit;
    modalRef.componentInstance.poolInfo = poolInfo;
    const dpool: DPool = this.allPoolList.find(
      (pool) => pool.name === poolInfo.name
    );
    modalRef.componentInstance.mphDepositorRewardMintMultiplier = dpool
      ? dpool.mphDepositorRewardMintMultiplier
      : new BigNumber(0);
  }

  openRollOverModal(userDeposit: UserDeposit, poolInfo: PoolInfo) {
    const modalRef = this.modalService.open(ModalRollOverComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.userDeposit = userDeposit;
    modalRef.componentInstance.poolInfo = poolInfo;
    const dpool: DPool = this.allPoolList.find(
      (pool) => pool.name === poolInfo.name
    );
    modalRef.componentInstance.mphDepositorRewardMintMultiplier = dpool
      ? dpool.mphDepositorRewardMintMultiplier
      : new BigNumber(0);
  }

  openNFTModal(userDeposit: UserDeposit, poolInfo: PoolInfo) {
    const modalRef = this.modalService.open(ModalNftComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.userDeposit = userDeposit;
    modalRef.componentInstance.poolInfo = poolInfo;
  }

  userHasDeposit(poolName: string): boolean {
    const userPool = this.userPools.find(
      (userPool) => userPool.poolInfo.name === poolName
    );
    return userPool ? true : false;
  }

  claimAllRewards() {
    const userPools = this.userPools;
    const vestContract = this.contract.getNamedContract('Vesting02');
    let vestIdList = new Array<number>(0);

    for (let pool in userPools) {
      // for each pool
      const userDeposits = userPools[pool].deposits;
      for (let deposit in userDeposits) {
        // for each deposit
        const vest = userDeposits[deposit].vest;
        const vestID = vest.nftID;
        vestIdList.push(vestID);
      }
    }

    const func = vestContract.methods.multiWithdraw(vestIdList);

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {
        this.router.navigateByUrl('/stake');
      },
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }
}

interface QueryResult {
  user: {
    address: string;
    pools: {
      id: string;
      address: string;
      deposits: {
        nftID: string;
        virtualTokenTotalSupply: string;
        maturationTimestamp: string;
        depositTimestamp: string;
        interestRate: string;
        feeRate: string;
        amount: string;
        vest: {
          owner: string;
          nftID: string;
          lastUpdateTimestamp: string;
          accumulatedAmount: string;
          withdrawnAmount: string;
          vestAmountPerStablecoinPerSecond: string;
          totalExpectedMPHAmount: string;
        };
      }[];
    }[];
    totalDepositByPool: {
      pool: {
        address: string;
        stablecoin: string;
      };
      totalDeposit: string;
      totalInterestOwed: string;
    }[];
  };
  dpools: {
    id: string;
    address: string;
    totalDeposit: string;
    poolDepositorRewardMintMultiplier: string;
  }[];
}
