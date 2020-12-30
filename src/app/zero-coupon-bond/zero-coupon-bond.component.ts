import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { WalletService } from '../wallet.service';
import { ContractService, PoolInfo } from '../contract.service';
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
  selector: 'app-zero-coupon-bond',
  templateUrl: './zero-coupon-bond.component.html',
  styleUrls: ['./zero-coupon-bond.component.css']
})
export class ZeroCouponBondComponent implements OnInit {
  YEAR_IN_SEC = 31556952; // Number of seconds in a year
  DECIMALS = 4;

  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;
  totalMPHEarned: BigNumber;
  mphPriceUSD: BigNumber;

  constructor(
    private modalService: NgbModal,
    private apollo: Apollo,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    await this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    const userID = this.wallet.connected ? this.wallet.userAddress.toLowerCase() : '';
    const queryString = gql`
      {
        ${loadUser ? `user(id: "${userID}") {
          totalMPHEarned
          totalMPHPaidBack
          pools {
            id
            address
            mphDepositorRewardTakeBackMultiplier
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
        }` : ''}
        ${loadGlobal ? `dpools {
          id
          address
          totalActiveDeposit
          oneYearInterestRate
          mphDepositorRewardMintMultiplier
          mphDepositorRewardTakeBackMultiplier
        }` : ''}
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


        // compute total deposit & interest in USD
        let totalDepositUSD = new BigNumber(0);
        let totalInterestUSD = new BigNumber(0);
        Promise.all(user.totalDepositByPool.map(async totalDepositEntity => {
          let stablecoinPrice = stablecoinPriceCache[totalDepositEntity.pool.stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(totalDepositEntity.pool.stablecoin);
            stablecoinPriceCache[totalDepositEntity.pool.stablecoin] = stablecoinPrice;
          }

          const poolDepositUSD = new BigNumber(totalDepositEntity.totalActiveDeposit).times(stablecoinPrice);
          const poolInterestUSD = new BigNumber(totalDepositEntity.totalInterestEarned).times(stablecoinPrice);
          totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
          totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
        })).then(() => {
          this.totalDepositUSD = totalDepositUSD;
          this.totalInterestUSD = this.helpers.applyFeeToInterest(totalInterestUSD);
        });
      }
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.totalDepositUSD = new BigNumber(0);
      this.totalInterestUSD = new BigNumber(0);
      this.totalMPHEarned = new BigNumber(0);
    }
  }

}

interface QueryResult {
  user: {
    totalMPHEarned: number;
    totalMPHPaidBack: number;
    pools: {
      id: string;
      address: string;
      mphDepositorRewardTakeBackMultiplier: number;
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
    mphDepositorRewardMintMultiplier: number;
    mphDepositorRewardTakeBackMultiplier: number;
  }[];
}
