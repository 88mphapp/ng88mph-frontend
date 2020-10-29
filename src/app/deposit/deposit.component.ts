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
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';

const mockUser = {
  totalMPHEarned: 1e3,
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
    if (this.wallet.connected) {
      this.loadData();
    }
    this.wallet.connectedEvent.subscribe(() => {
      this.loadData();
    });
    this.wallet.errorEvent.subscribe(() => {
      this.resetData();
    });
  }

  loadData(): void {
    const userID = this.wallet.userAddress.toLowerCase();
    const queryString = gql`
      {
        user(id: "${userID}") {
          totalMPHEarned
          deposits(where: { active: true }) {
            nftID
            pool {
              address
            }
            amount
            maturationTimestamp
            depositTimestamp
            interestEarned
            fundingID
            mintMPHAmount
            takeBackMPHAmount
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
      const user = mockUser;//queryResult.data.user;
      const dpools = queryResult.data.dpools;
      let stablecoinPriceCache = {};
      if (user) {
        // update totalMPHEarned
        this.totalMPHEarned = new BigNumber(user.totalMPHEarned);

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

          const dpoolObj = {
            name: poolInfo.name,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            iconPath: poolInfo.iconPath,
            totalDepositToken: new BigNumber(pool.totalActiveDeposit),
            totalDepositUSD: new BigNumber(pool.totalActiveDeposit).times(stablecoinPrice),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(100),
          } as DPool;
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
    this.allPoolList = [];
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
    deposits: {
      nftID: number;
      pool: {
        address: string;
      }
      amount: number;
      maturationTimestamp: number;
      depositTimestamp: number;
      interestEarned: number;
      fundingID: number;
      mintMPHAmount: number;
      takeBackMPHAmount: number;
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