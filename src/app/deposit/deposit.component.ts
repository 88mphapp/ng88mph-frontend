import { Component, OnInit, NgZone } from '@angular/core';
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
import {
  AllPool,
  GlobalPool,
  UserPool,
  UserDeposit,
  Vest,
  UserZCBPool,
} from './types';
import { HelpersService } from '../helpers.service';
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

  // get started
  hasDeposit: boolean;
  claimedMPH: boolean;
  stakedMPH: boolean;
  stepsCompleted: number;
  displayGetStarted: boolean;

  // user
  userVestList: Vest[];
  userPoolList: UserPool[];
  userTotalDepositUSD: BigNumber;
  userTotalInterestUSD: BigNumber;
  userTotalClaimableReward: BigNumber;
  userZCBPools: UserZCBPool[];

  // global
  globalPoolList: GlobalPool[];
  allZCBPoolList: ZeroCouponBondInfo[];

  // all
  allPoolList: AllPool[];
  allAssetList: string[];
  allProtocolList: string[];
  selectedAsset: string;
  selectedProtocol: string;

  constructor(
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    public datas: DataService,
    private router: Router,
    private zone: NgZone
  ) {
    this.resetData(true, true, true);
  }

  ngOnInit(): void {
    this.loadData(
      this.wallet.connected || this.wallet.watching,
      true,
      true,
      this.wallet.networkID
    );
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false, false);
      this.loadData(true, false, false, this.wallet.networkID);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false, true);
      this.loadData(false, false, true, this.wallet.networkID);
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true, true);
        this.loadData(
          this.wallet.connected || this.wallet.watching,
          true,
          true,
          networkID
        );
      });
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false, true);
        this.loadData(true, false, true, this.wallet.networkID);
      });
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      setTimeout(() => {
        this.resetData(true, false, false);
        this.loadData(true, false, false, this.wallet.networkID);
      }, this.constants.TX_CONFIRMATION_REFRESH_WAIT_TIME);
    });
  }

  resetData(
    resetUser: boolean,
    resetGlobal: boolean,
    resetPools: boolean
  ): void {
    if (resetUser) {
      this.userVestList = [];
      this.userPoolList = [];
      this.userTotalDepositUSD = new BigNumber(0);
      this.userTotalInterestUSD = new BigNumber(0);
      this.userTotalClaimableReward = new BigNumber(0);
      this.hasDeposit = false;
      this.claimedMPH = false;
      this.stakedMPH = false;
      this.stepsCompleted = 0;
      this.userZCBPools = [];
    }

    if (resetGlobal) {
      this.globalPoolList = [];
      this.allZCBPoolList = [];
    }

    if (resetPools) {
      this.allPoolList = [];
      this.allAssetList = [];
      this.allProtocolList = [];
      this.selectedAsset = 'all';
      this.selectedProtocol = 'best';
    }
  }

  async loadData(
    loadUser: boolean,
    loadGlobal: boolean,
    loadPools: boolean,
    networkID: number
  ) {
    this.displayGetStarted =
      window.localStorage.getItem('displayEarnGetStarted') != 'false';

    await Promise.all([
      loadPools ? this.loadPoolData(networkID) : null,
      loadGlobal ? this.loadGlobalData(networkID) : null,
      loadUser ? this.loadUserData(networkID) : null,
    ]).then(() => {
      if (networkID !== this.wallet.networkID) return;

      // merge global data
      for (let globalPool of this.globalPoolList) {
        const allPool = this.allPoolList.find(
          (allPool) => allPool.address === globalPool.address
        );
        allPool.mphDepositorRewardMintMultiplier =
          globalPool.mphDepositorRewardMintMultiplier;
        allPool.maxAPR = globalPool.maxAPR;
        allPool.mphAPR = globalPool.mphAPR;
        allPool.isBest = globalPool.isBest;
      }

      // merge user data
      for (let userPool of this.userPoolList) {
        const allPool = this.allPoolList.find(
          (allPool) => allPool.address === userPool.address
        );
        allPool.userDeposits = userPool.userDeposits;
        allPool.userTotalDeposit = userPool.userTotalDeposit;
        allPool.userTotalDepositUSD = userPool.userTotalDepositUSD;
      }

      this.allPoolList = [
        ...this.allPoolList.sort((a, b) => {
          return (
            b.userTotalDepositUSD.toNumber() - a.userTotalDepositUSD.toNumber()
          );
        }),
      ];
    });
  }

  loadPoolData(networkID: number) {
    let allPoolList: AllPool[] = [];
    let allAssetList: string[] = [];
    let allProtocolList: string[] = [];

    const dpools = this.contract.getPoolInfoList(networkID);
    Promise.all(
      dpools.map((poolInfo) => {
        if (poolInfo.protocol === 'Cream') return;

        const poolObj: AllPool = {
          // general
          name: poolInfo.name,
          address: poolInfo.address,
          protocol: poolInfo.protocol,
          stablecoin: poolInfo.stablecoin,
          stablecoinSymbol: poolInfo.stablecoinSymbol,
          iconPath: poolInfo.iconPath,
          poolInfo: poolInfo,
          isExpanded: false,

          // global
          mphDepositorRewardMintMultiplier: new BigNumber(0),
          maxAPR: new BigNumber(0),
          mphAPR: new BigNumber(0),
          isBest: false,

          // user
          userDeposits: [],
          userTotalDeposit: new BigNumber(0),
          userTotalDepositUSD: new BigNumber(0),
        };
        allPoolList.push(poolObj);

        if (!allAssetList.includes(poolInfo.stablecoinSymbol)) {
          allAssetList.push(poolInfo.stablecoinSymbol);
        }
        if (!allProtocolList.includes(poolInfo.protocol)) {
          allProtocolList.push(poolInfo.protocol);
        }
      })
    ).then(() => {
      allPoolList.sort((a, b) => {
        return a.stablecoinSymbol > b.stablecoinSymbol ? 1 : -1;
      });
      this.allPoolList = allPoolList;

      allAssetList.sort((a, b) => {
        return a > b ? 1 : a < b ? -1 : 0;
      });
      this.allAssetList = allAssetList;

      allProtocolList.sort((a, b) => {
        return a > b ? 1 : a < b ? -1 : 0;
      });
      this.allProtocolList = allProtocolList;
    });
  }

  async loadGlobalData(networkID: number) {
    const queryString = gql`
      {
        dpools {
          address
          poolDepositorRewardMintMultiplier
        }
      }
    `;
    await request(this.constants.GRAPHQL_ENDPOINT[networkID], queryString).then(
      (data: GlobalQueryResult) => this.handleGlobalData(data, networkID)
    );
  }

  async loadUserData(networkID: number) {
    const userID = this.wallet.actualAddress.toLowerCase();
    if (!userID) return;

    // load xMPH balance for 'get started' section
    const web3 = this.wallet.httpsWeb3(networkID);
    const xmph = this.contract.getNamedContract('xMPH', web3);
    if (xmph.options.address) {
      xmph.methods
        .balanceOf(userID)
        .call()
        .then((result) => {
          const balance = new BigNumber(result).div(this.constants.PRECISION);
          if (balance.gt(0)) {
            this.stakedMPH = true;
            this.stepsCompleted += 1;
          }
        });
    }

    const queryString = gql`
      {
        user (id: "${userID}") {
          address
          pools {
            address
            deposits (where: { user: "${userID}" }) {
              nftID
              amount
              interestRate
              depositTimestamp
              maturationTimestamp
              virtualTokenTotalSupply
              vest {
                owner
                nftID
                vestAmountPerStablecoinPerSecond
                totalExpectedMPHAmount
                lastUpdateTimestamp
                accumulatedAmount
                withdrawnAmount
              }
            }
          }
        }
      }
    `;
    await request(this.constants.GRAPHQL_ENDPOINT[networkID], queryString).then(
      (data: UserQueryResult) => this.handleUserData(data, networkID)
    );
  }

  async handleGlobalData(data: GlobalQueryResult, networkID: number) {
    if (networkID !== this.wallet.networkID) return;

    let globalPoolList: GlobalPool[] = [];
    const dpools = data.dpools;
    await Promise.all(
      dpools.map(async (pool) => {
        const poolInfo = this.contract.getPoolInfoFromAddress(
          pool.address,
          networkID
        );
        if (poolInfo.protocol === 'Cream') return;

        // get MPH APR
        const stablecoinPrice = await this.datas.getAssetPriceUSD(
          poolInfo.stablecoin,
          networkID
        );
        const mphDepositorRewardMintMultiplier = new BigNumber(
          pool.poolDepositorRewardMintMultiplier
        );
        const mphAPR = mphDepositorRewardMintMultiplier
          .times(this.datas.mphPriceUSD)
          .times(this.constants.YEAR_IN_SEC)
          .div(stablecoinPrice)
          .times(100);

        // create the poolObj
        const poolObj: GlobalPool = {
          address: poolInfo.address,
          stablecoin: poolInfo.stablecoin,
          mphDepositorRewardMintMultiplier: mphDepositorRewardMintMultiplier,
          maxAPR: await this.datas.getPoolMaxAPR(poolInfo.address),
          mphAPR: mphAPR,
          isBest: false,
        };

        // update best pool
        const sameAssetPools = globalPoolList.filter(
          (x) => x.stablecoin === poolObj.stablecoin
        );
        if (sameAssetPools.length === 0) {
          poolObj.isBest = true;
        } else {
          const bestPool = sameAssetPools.find((x) => x.isBest === true);
          if (poolObj.maxAPR.gt(bestPool.maxAPR)) {
            bestPool.isBest = false;
            poolObj.isBest = true;
          }
        }

        globalPoolList.push(poolObj);
      })
    ).then(() => {
      this.globalPoolList = globalPoolList;
    });
  }

  async handleUserData(data: UserQueryResult, networkID: number) {
    if (networkID !== this.wallet.networkID) return;

    const user = data.user;
    if (!user) return;

    let userVestList: Vest[] = [];
    let userPoolList: UserPool[] = [];
    let userTotalDepositUSD: BigNumber = new BigNumber(0);
    let userTotalInterestUSD: BigNumber = new BigNumber(0);
    let userTotalClaimableReward: BigNumber = new BigNumber(0);

    Promise.all(
      user.pools.map(async (pool) => {
        const poolInfo = this.contract.getPoolInfoFromAddress(
          pool.address,
          networkID
        );
        const stablecoinPrice = await this.datas.getAssetPriceUSD(
          poolInfo.stablecoin,
          networkID
        );

        let userDepositList: UserDeposit[] = [];
        let userPoolDeposit: BigNumber = new BigNumber(0);
        let userPoolInterest: BigNumber = new BigNumber(0);

        Promise.all(
          pool.deposits.map((deposit) => {
            const vest = deposit.vest;
            const amount = new BigNumber(deposit.amount); // @dev should virtualTokenTotalSupply/(interestRate + 1) be used?
            const interest = amount.times(deposit.interestRate);
            const interestAPR = interest
              .div(amount)
              .div(
                parseInt(deposit.maturationTimestamp) -
                  parseInt(deposit.depositTimestamp)
              )
              .times(this.constants.YEAR_IN_SEC)
              .times(100);

            let reward = new BigNumber(0);
            let rewardAPR = new BigNumber(0);
            let claimableReward = new BigNumber(0);
            let vestObj: Vest;

            if (vest) {
              // @dev chains without rewards won't have a vest
              if (vest.owner === user.address) {
                // @dev vest hasn't been transferred

                // calculate reward for deposit
                reward = reward.plus(vest.accumulatedAmount);
                if (
                  parseInt(deposit.maturationTimestamp) >
                  parseInt(vest.lastUpdateTimestamp)
                ) {
                  const unvestedReward = amount
                    .times(vest.vestAmountPerStablecoinPerSecond)
                    .times(
                      parseInt(deposit.maturationTimestamp) -
                        parseInt(vest.lastUpdateTimestamp)
                    );
                  reward = reward.plus(unvestedReward);
                }
                // @dev the below isn't correct for deposits withdrawn early, so we manually calculate above
                // reward = new BigNumber(vest.totalExpectedMPHAmount);

                rewardAPR = reward
                  .times(this.datas.mphPriceUSD)
                  .div(amount.times(stablecoinPrice))
                  .div(
                    parseInt(deposit.maturationTimestamp) -
                      parseInt(deposit.depositTimestamp)
                  )
                  .times(this.constants.YEAR_IN_SEC)
                  .times(100);

                // create vest object for list
                vestObj = {
                  nftID: parseInt(vest.nftID),
                  vestAmountPerStablecoinPerSecond: new BigNumber(
                    vest.vestAmountPerStablecoinPerSecond
                  ),
                  totalExpectedMPHAmount: reward,
                  lastUpdateTimestamp: parseInt(vest.lastUpdateTimestamp),
                  accumulatedAmount: new BigNumber(vest.accumulatedAmount),
                  withdrawnAmount: new BigNumber(vest.withdrawnAmount),
                };
                userVestList.push(vestObj);

                // calculate total claimable MPH
                const currentTimestamp = Math.min(
                  Math.floor(Date.now() / 1e3),
                  parseFloat(deposit.maturationTimestamp)
                );
                claimableReward = claimableReward
                  .plus(vest.accumulatedAmount)
                  .minus(vest.withdrawnAmount);
                if (currentTimestamp >= parseInt(vest.lastUpdateTimestamp)) {
                  // @dev add reward since last update
                  claimableReward = claimableReward.plus(
                    amount
                      .times(
                        currentTimestamp - parseInt(vest.lastUpdateTimestamp)
                      )
                      .times(vest.vestAmountPerStablecoinPerSecond)
                  );
                }
                userTotalClaimableReward =
                  userTotalClaimableReward.plus(claimableReward);

                // update steps completed
                if (vestObj.withdrawnAmount.gt(0) && !this.claimedMPH) {
                  this.claimedMPH = true;
                  this.stepsCompleted += 1;
                }
              }
            }

            if (amount.gt(this.constants.DUST_THRESHOLD)) {
              // add amount and interest to totals
              userPoolDeposit = userPoolDeposit.plus(amount);
              userPoolInterest = userPoolInterest.plus(interest);

              // create the deposit object
              const depositObj: UserDeposit = {
                nftID: parseInt(deposit.nftID),
                amount: amount,
                amountUSD: amount.times(stablecoinPrice),

                interest: interest,
                interestUSD: interest.times(stablecoinPrice),
                interestAPR: interestAPR,

                reward: reward,
                rewardUSD: reward.times(this.datas.mphPriceUSD),
                rewardAPR: rewardAPR,

                virtualTokenTotalSupply: new BigNumber(
                  deposit.virtualTokenTotalSupply
                ),
                depositLength:
                  parseInt(deposit.maturationTimestamp) -
                  parseInt(deposit.depositTimestamp),
                maturation: parseInt(deposit.maturationTimestamp),
                locked:
                  parseInt(deposit.maturationTimestamp) >= Date.now() / 1e3,
                vest: vestObj,
              };
              userDepositList.push(depositObj);

              // update steps completed
              if (!this.hasDeposit) {
                this.hasDeposit = true;
                this.stepsCompleted += 1;
              }
            }
          })
        ).then(() => {
          // get user total deposit
          const userPoolDepositUSD = userPoolDeposit.times(stablecoinPrice);
          userTotalDepositUSD = userTotalDepositUSD.plus(userPoolDepositUSD);

          // get user total interest
          const userPoolInterestUSD = userPoolInterest.times(stablecoinPrice);
          userTotalInterestUSD = userTotalInterestUSD.plus(userPoolInterestUSD);

          // create the user pool object
          if (userPoolDeposit.gt(this.constants.DUST_THRESHOLD)) {
            const poolObj: UserPool = {
              address: poolInfo.address,
              userDeposits: userDepositList,
              userTotalDeposit: userPoolDeposit,
              userTotalDepositUSD: userPoolDepositUSD,
            };
            userPoolList.push(poolObj);
          }
        });
      })
    ).then(() => {
      this.userVestList = userVestList;
      this.userPoolList = userPoolList;
      this.userTotalDepositUSD = userTotalDepositUSD;
      this.userTotalInterestUSD = userTotalInterestUSD;
      this.userTotalClaimableReward = userTotalClaimableReward.dp(18);
    });
  }

  async getZeroCouponBondPriceUSD(
    bond: ZeroCouponBondInfo,
    pool: PoolInfo
  ): Promise<BigNumber> {
    return new BigNumber(
      await this.helpers.getTokenPriceUSD(
        pool.stablecoin,
        this.wallet.networkID
      )
    );
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
    const dpool: AllPool = this.allPoolList.find(
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
    const dpool: AllPool = this.allPoolList.find(
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

  userHasDeposit(poolAddress: string): boolean {
    const userPool = this.userPoolList.find(
      (userPool) => userPool.address === poolAddress
    );
    return userPool ? true : false;
  }

  updateCache() {
    window.localStorage.setItem('displayEarnGetStarted', 'false');
  }

  claimAllRewards() {
    const userVests = this.userVestList;
    const vestContract = this.contract.getNamedContract('Vesting02');
    let vestIdList = new Array<number>(0);

    for (let vest in userVests) {
      const vestID = userVests[vest].nftID;
      vestIdList.push(vestID);
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

  toggleAllDeposits() {
    for (let pool in this.allPoolList) {
      if (this.allPoolList[pool].userDeposits.length > 0) {
        this.allPoolList[pool].isExpanded = !this.allPoolList[pool].isExpanded;
      }
    }
  }

  sortBy(event: any) {
    if (event.active === 'stablecoinSymbol') {
      this.allPoolList =
        event.direction === 'asc'
          ? [
              ...this.allPoolList.sort((a, b) =>
                a[event.active] > b[event.active] ? 1 : -1
              ),
            ]
          : [
              ...this.allPoolList.sort((a, b) =>
                b[event.active] > a[event.active] ? 1 : -1
              ),
            ];
    } else {
      this.allPoolList =
        event.direction === 'asc'
          ? [
              ...this.allPoolList.sort(
                (a, b) => a[event.active] - b[event.active]
              ),
            ]
          : [
              ...this.allPoolList.sort(
                (a, b) => b[event.active] - a[event.active]
              ),
            ];
    }
  }

  sortByDeposits(pool: AllPool, event: any) {
    pool.userDeposits =
      event.direction === 'asc'
        ? [
            ...pool.userDeposits.sort(
              (a, b) => a[event.active] - b[event.active]
            ),
          ]
        : [
            ...pool.userDeposits.sort(
              (a, b) => b[event.active] - a[event.active]
            ),
          ];
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleDateString();
  }

  displayError() {
    const pool = this.allPoolList.find(
      (pool) =>
        pool.protocol === this.selectedProtocol &&
        pool.stablecoinSymbol === this.selectedAsset
    );
    if (
      this.selectedProtocol !== 'all' &&
      this.selectedProtocol !== 'best' &&
      this.selectedAsset !== 'all' &&
      !pool
    ) {
      return true;
    }
    return false;
  }
}

interface GlobalQueryResult {
  dpools: {
    address: string;
    poolDepositorRewardMintMultiplier: string;
  }[];
}

interface UserQueryResult {
  user: {
    address: string;
    pools: {
      address: string;
      deposits: {
        nftID: string;
        amount: string;
        interestRate: string;
        depositTimestamp: string;
        maturationTimestamp: string;
        virtualTokenTotalSupply: string;
        vest: {
          owner: string;
          nftID: string;
          vestAmountPerStablecoinPerSecond: string;
          totalExpectedMPHAmount: string;
          lastUpdateTimestamp: string;
          accumulatedAmount: string;
          withdrawnAmount: string;
        };
      }[];
    }[];
  };
}

// @dev ZCBs are not yet implemented, so this has been preserved here

// load Zero Coupon Bond / Preset Maturity data
// const zcbPoolNameList = this.contract.getZeroCouponBondPoolNameList();
// const zcbPoolList = zcbPoolNameList.map((poolName) =>
//   this.contract.getZeroCouponBondPool(poolName)
// );
// this.allZCBPoolList = zcbPoolList.concat.apply([], zcbPoolList);
// const userZCBPools = [];
// let totalDepositUSD = new BigNumber(0);
// for (let zcbPool of this.allZCBPoolList) {
//   const zcbContract = this.contract.getZeroCouponBondContract(
//     zcbPool.address,
//     web3
//   );
//   const poolInfo = this.contract.getPoolInfoFromAddress(
//     await zcbContract.methods.pool().call()
//   );
//   const userBalance = new BigNumber(
//     await zcbContract.methods.balanceOf(userID).call()
//   ).div(Math.pow(10, poolInfo.stablecoinDecimals));
//
//   if (userBalance.gt(this.constants.DUST_THRESHOLD)) {
//     const zcbPriceUSD = new BigNumber(
//       await this.getZeroCouponBondPriceUSD(zcbPool, poolInfo)
//     );
//     const userBalanceUSD = userBalance.times(zcbPriceUSD);
//     const maturationTimestamp = await zcbContract.methods
//       .maturationTimestamp()
//       .call();
//     const maturationDate = new Date(
//       maturationTimestamp * 1e3
//     ).toLocaleString('en-US', {
//       month: 'long',
//       day: 'numeric',
//       year: 'numeric',
//     });
//     let userZCB: UserZCBPool = {
//       zcbPoolInfo: zcbPool,
//       poolInfo: poolInfo,
//       amountToken: userBalance,
//       amountUSD: userBalanceUSD,
//       maturation: maturationDate,
//       locked: +maturationTimestamp >= Date.now() / 1e3,
//     };
//     userZCBPools.push(userZCB);
//     totalDepositUSD = totalDepositUSD.plus(userBalanceUSD);
//   }
// }
// this.userZCBPools = userZCBPools;
// this.totalDepositUSD = totalDepositUSD;
// }
