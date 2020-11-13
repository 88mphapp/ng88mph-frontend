import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ModalDepositComponent } from './modal-deposit/modal-deposit.component';
import { ModalWithdrawComponent } from './modal-withdraw/modal-withdraw.component';
import { WalletService } from '../wallet.service';
import { ContractService, PoolInfo } from '../contract.service';
import { DPool, UserPool, UserDeposit } from './types';
import { HelpersService } from '../helpers.service';
import { Timer } from '../timer';
import { ConstantsService } from '../constants.service';

const mockUser = {
  totalMPHEarned: 1e3,
  pools: [
    {
      address: '0xb5EE8910A93F8A450E97BE0436F36B9458106682',
      deposits: [
        {
          nftID: 1,
          amount: 1e3,
          maturationTimestamp: 1609459200,
          depositTimestamp: 1601510400,
          interestEarned: 1e2,
          mintMPHAmount: 1e2,
          takeBackMPHAmount: 0
        }
      ]
    },
    {
      address: '0xEB2F0A3045db12366A9f6A8e922D725D86a117EB',
      deposits: [
        {
          nftID: 1,
          amount: 1e3,
          maturationTimestamp: 1601510400,
          depositTimestamp: 1601510400,
          interestEarned: 1e2,
          mintMPHAmount: 1e2,
          takeBackMPHAmount: 0
        }
      ]
    }
  ],
  totalDeposits: [{
    pool: {
      stablecoin: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    },
    totalActiveDeposit: 1e6,
    totalInterestEarned: 1e4
  }]
};

@Component({
  selector: 'app-deposit',
  templateUrl: './deposit.component.html',
  styleUrls: ['./deposit.component.css']
})
export class DepositComponent implements OnInit {
  YEAR_IN_SEC = 31556952; // Number of seconds in a year

  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;
  totalMPHEarned: BigNumber;
  allPoolList: DPool[];
  userPools: UserPool[];
  mphPriceUSD: BigNumber;

  constructor(
    private modalService: NgbModal,
    private apollo: Apollo,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
    this.wallet.connectedEvent.subscribe(() => {
      this.loadData();
    });
    this.wallet.errorEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    await this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    const userID = this.wallet.connected ? this.wallet.userAddress.toLowerCase() : '';
    const queryString = gql`
      {
        user(id: "${userID}") {
          totalMPHEarned
          totalMPHPaidBack
          pools {
            id
            address
            mphDepositorRewardMultiplier
            deposits(where: { user: "${userID}", active: true }, orderBy: nftID) {
              nftID
              fundingID
              amount
              maturationTimestamp
              depositTimestamp
              interestEarned
              mintMPHAmount
              takeBackMPHAmount
            }
          }
          totalDepositByPool {
            pool {
              stablecoin
            }
            totalActiveDeposit
            totalInterestEarned
          }
        }
        dpools {
          id
          address
          totalActiveDeposit
          oneYearInterestRate
          mphDepositorRewardMultiplier
          mphMintingMultiplier
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const user = queryResult.data.user;
      const dpools = queryResult.data.dpools;
      let stablecoinPriceCache = {};
      if (user) {
        // update totalMPHEarned
        this.totalMPHEarned = new BigNumber(user.totalMPHEarned).minus(user.totalMPHPaidBack);

        // process user deposit list
        const userPools: UserPool[] = [];
        for (const pool of user.pools) {
          if (pool.deposits.length == 0) continue;
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const stablecoin = poolInfo.stablecoin.toLowerCase()
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }
          const userPoolDeposits: Array<UserDeposit> = [];
          for (const deposit of pool.deposits) {
            let mphDepositorRewardMultiplier = new BigNumber(pool.mphDepositorRewardMultiplier);
            const realMPHReward = mphDepositorRewardMultiplier.times(deposit.mintMPHAmount);
            const mphAPY = realMPHReward.times(this.mphPriceUSD).div(deposit.amount).div(stablecoinPrice).div(deposit.maturationTimestamp - deposit.depositTimestamp).times(this.constants.YEAR_IN_SEC).times(100);
            const userPoolDeposit: UserDeposit = {
              nftID: deposit.nftID,
              fundingID: deposit.fundingID,
              locked: deposit.maturationTimestamp >= (Date.now() / 1e3),
              amountToken: new BigNumber(deposit.amount),
              amountUSD: new BigNumber(deposit.amount).times(stablecoinPrice),
              apy: new BigNumber(deposit.interestEarned).div(deposit.amount).div(deposit.maturationTimestamp - deposit.depositTimestamp).times(this.YEAR_IN_SEC).times(100),
              countdownTimer: new Timer(deposit.maturationTimestamp, 'down'),
              interestEarnedToken: new BigNumber(deposit.interestEarned),
              interestEarnedUSD: new BigNumber(deposit.interestEarned).times(stablecoinPrice),
              mintMPHAmount: new BigNumber(deposit.mintMPHAmount),
              realMPHReward: realMPHReward,
              mphAPY: mphAPY
            }
            userPoolDeposit.countdownTimer.start();
            userPoolDeposits.push(userPoolDeposit);
          }

          const userPool: UserPool = {
            poolInfo: poolInfo,
            deposits: userPoolDeposits
          };
          userPools.push(userPool);
        }
        this.userPools = userPools;

        // compute total deposit & interest in USD
        let totalDepositUSD = new BigNumber(0);
        let totalInterestUSD = new BigNumber(0);
        for (const totalDepositEntity of user.totalDepositByPool) {
          let stablecoinPrice = stablecoinPriceCache[totalDepositEntity.pool.stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(totalDepositEntity.pool.stablecoin);
            stablecoinPriceCache[totalDepositEntity.pool.stablecoin] = stablecoinPrice;
          }

          const poolDepositUSD = new BigNumber(totalDepositEntity.totalActiveDeposit).times(stablecoinPrice);
          const poolInterestUSD = new BigNumber(totalDepositEntity.totalInterestEarned).times(stablecoinPrice);
          totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
          totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
        }
        this.totalDepositUSD = totalDepositUSD;
        this.totalInterestUSD = totalInterestUSD;
      }
      if (dpools) {
        let allPoolList = new Array<DPool>(0);
        for (const pool of dpools) {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          const stablecoin = poolInfo.stablecoin.toLowerCase()
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          // get MPH APY
          const poolMintingMultiplier = new BigNumber(pool.mphMintingMultiplier);
          const mphDepositorRewardMultiplier = new BigNumber(pool.mphDepositorRewardMultiplier);
          const tempMPHAPY = poolMintingMultiplier.times(pool.oneYearInterestRate).times(this.mphPriceUSD).div(stablecoinPrice).times(100);
          const mphAPY = tempMPHAPY.times(mphDepositorRewardMultiplier);

          const dpoolObj: DPool = {
            name: poolInfo.name,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            iconPath: poolInfo.iconPath,
            totalDepositToken: new BigNumber(pool.totalActiveDeposit),
            totalDepositUSD: new BigNumber(pool.totalActiveDeposit).times(stablecoinPrice),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(100),
            mphAPY: mphAPY,
            tempMPHAPY: tempMPHAPY
          };
          allPoolList.push(dpoolObj);
        }
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
      }
    }
  }

  resetData(): void {
    this.totalDepositUSD = new BigNumber(0);
    this.totalInterestUSD = new BigNumber(0);
    this.totalMPHEarned = new BigNumber(0);
    this.userPools = [];
    this.mphPriceUSD = new BigNumber(0);

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
        oneYearInterestRate: new BigNumber(0),
        mphAPY: new BigNumber(0),
        tempMPHAPY: new BigNumber(0)
      };
      allPoolList.push(dpoolObj);
    }
    this.allPoolList = allPoolList;
  }

  openDepositModal(poolName?: string) {
    const modalRef = this.modalService.open(ModalDepositComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.defaultPoolName = poolName;
  }

  openWithdrawModal(userDeposit: UserDeposit, poolInfo: PoolInfo) {
    const modalRef = this.modalService.open(ModalWithdrawComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.userDeposit = userDeposit;
    modalRef.componentInstance.poolInfo = poolInfo;
  }
}

interface QueryResult {
  user: {
    totalMPHEarned: number;
    totalMPHPaidBack: number;
    pools: {
      id: string;
      address: string;
      mphDepositorRewardMultiplier: number;
      deposits: {
        nftID: number;
        fundingID: number;
        amount: number;
        maturationTimestamp: number;
        depositTimestamp: number;
        interestEarned: number;
        mintMPHAmount: number;
        takeBackMPHAmount: number;
      }[];
    }[];
    totalDepositByPool: {
      pool: {
        stablecoin: string;
      };
      totalActiveDeposit: number;
      totalHistoricalDeposit: number;
      totalInterestEarned: number;
    }[];
  };
  dpools: {
    id: string;
    address: string;
    totalActiveDeposit: number;
    oneYearInterestRate: number;
    mphDepositorRewardMultiplier: number;
    mphMintingMultiplier: number;
  }[];
}
