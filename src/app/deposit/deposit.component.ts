import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ModalDepositComponent } from './modal-deposit/modal-deposit.component';
import { ModalWithdrawComponent } from './modal-withdraw/modal-withdraw.component';
import { Router } from '@angular/router';
import { WalletService } from '../wallet.service';
import { ContractService, PoolInfo } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { Timer } from '../timer';

const mockUser = {
  totalMPHEarned: 1e3,
  pools: [
    {
      address: '0x6bA0251940E6c22c1FF5270198a134E3779B2f93',
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
      address: '0xF44AfBA5a8F55D54d4509db4baC51a9961B7aA05',
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
  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;
  totalMPHEarned: BigNumber;
  allPoolList: DPool[];
  userPools: UserPool[];

  constructor(
    private modalService: NgbModal,
    private apollo: Apollo,
    public route: Router,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService
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

  loadData(): void {
    const userID = this.wallet.connected ? this.wallet.userAddress.toLowerCase() : '';
    const queryString = gql`
      {
        user(id: "${userID}") {
          totalMPHEarned
          pools {
            address
            deposits(where: { user: "${userID}", active: true, orderBy: nftID }) {
              nftID
              amount
              maturationTimestamp
              depositTimestamp
              interestEarned
              mintMPHAmount
              takeBackMPHAmount
            }
          }
          totalDeposits {
            pool {
              stablecoin
            }
            totalActiveDeposit
            totalInterestEarned
          }
        }
        dpools {
          address
          totalActiveDeposit
          oneYearInterestRate
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
        this.totalMPHEarned = new BigNumber(user.totalMPHEarned);

        // process user deposit list
        const userPools: UserPool[] = [];
        for (const pool of user.pools) {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const stablecoin = poolInfo.stablecoin.toLowerCase()
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }
          const userPoolDeposits: Array<UserDeposit> = [];
          for (const deposit of pool.deposits) {
            const userPoolDeposit: UserDeposit = {
              nftID: deposit.nftID,
              amountToken: new BigNumber(deposit.amount),
              amountUSD: new BigNumber(deposit.amount).times(stablecoinPrice),
              countdownTimer: new Timer(deposit.maturationTimestamp, 'down'),
              interestEarnedToken: new BigNumber(deposit.interestEarned),
              interestEarnedUSD: new BigNumber(deposit.interestEarned).times(stablecoinPrice),
              mintMPHAmount: new BigNumber(deposit.mintMPHAmount)
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
        for (const totalDepositEntity of user.totalDeposits) {
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
        const allPoolList = new Array<DPool>(0);
        for (const pool of dpools) {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          const stablecoin = poolInfo.stablecoin.toLowerCase()
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          const dpoolObj: DPool = {
            name: poolInfo.name,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            iconPath: poolInfo.iconPath,
            totalDepositToken: new BigNumber(pool.totalActiveDeposit),
            totalDepositUSD: new BigNumber(pool.totalActiveDeposit).times(stablecoinPrice),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(100),
          };
          allPoolList.push(dpoolObj);
        }
        this.allPoolList = allPoolList;
      }
    }
  }

  resetData(): void {
    this.totalDepositUSD = new BigNumber(0);
    this.totalInterestUSD = new BigNumber(0);
    this.totalMPHEarned = new BigNumber(0);
    this.userPools = [];

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
      };
      allPoolList.push(dpoolObj);
    }
    this.allPoolList = allPoolList;
  }

  openDepositModal() {
    const modalRef = this.modalService.open(ModalDepositComponent, { windowClass: 'fullscreen' });
  }

  openWithdrawModal() {
    const modalRef = this.modalService.open(ModalWithdrawComponent, { windowClass: 'fullscreen' });
  }

}

interface QueryResult {
  user: {
    totalMPHEarned: number;
    pools: {
      address: string;
      deposits: {
        nftID: number;
        amount: number;
        maturationTimestamp: number;
        depositTimestamp: number;
        interestEarned: number;
        fundingID: number;
        mintMPHAmount: number;
        takeBackMPHAmount: number;
      }[];
    }[];
    totalDeposits: {
      pool: {
        stablecoin: string;
      };
      totalActiveDeposit: number;
      totalHistoricalDeposit: number;
      totalInterestEarned: number;
    }[];
  };
  dpools: {
    address: string;
    totalActiveDeposit: number;
    oneYearInterestRate: number;
  }[];
}

interface DPool {
  name: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  iconPath: string;
  totalDepositToken: BigNumber;
  totalDepositUSD: BigNumber;
  oneYearInterestRate: BigNumber;
}

interface UserPool {
  poolInfo: PoolInfo;
  deposits: UserDeposit[];
}

interface UserDeposit {
  nftID: number;
  amountToken: BigNumber;
  amountUSD: BigNumber;
  countdownTimer: Timer;
  interestEarnedToken: BigNumber;
  interestEarnedUSD: BigNumber;
  mintMPHAmount: BigNumber;
}