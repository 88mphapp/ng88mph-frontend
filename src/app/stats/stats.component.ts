import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { HelpersService } from '../helpers.service';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css']
})
export class StatsComponent implements OnInit {
  mphTotalSupply: BigNumber;
  mphStakedPercentage: BigNumber;
  mphTotalHistoricalReward: BigNumber;
  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;
  mphPriceUSD: BigNumber;

  constructor(private apollo: Apollo, public helpers: HelpersService) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const queryString = gql`
      {
        dpools {
          id
          stablecoin
          totalActiveDeposit
          totalInterestPaid
        }
        mph(id: "0") {
          id
          totalSupply
          totalStakedMPHBalance
          totalHistoricalReward
          rewardPerMPHPerSecond
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const dpools = queryResult.data.dpools;
      const mph = queryResult.data.mph;

      if (dpools) {
        let totalDepositUSD = new BigNumber(0);
        let totalInterestUSD = new BigNumber(0);
        let stablecoinPriceCache = {};
        Promise.all(
          dpools.map(async pool => {
            let stablecoinPrice = stablecoinPriceCache[pool.stablecoin];
            if (!stablecoinPrice) {
              stablecoinPrice = await this.helpers.getTokenPriceUSD(pool.stablecoin);
              stablecoinPriceCache[pool.stablecoin] = stablecoinPrice;
            }

            const poolDepositUSD = new BigNumber(pool.totalActiveDeposit).times(stablecoinPrice);
            const poolInterestUSD = new BigNumber(pool.totalInterestPaid).times(stablecoinPrice);
            totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
            totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
          })
        ).then(() => {
          this.totalDepositUSD = totalDepositUSD;
          this.totalInterestUSD = this.helpers.applyFeeToInterest(totalInterestUSD);
        });
      }

      if (mph) {
        this.mphTotalSupply = new BigNumber(mph.totalSupply);
        this.mphStakedPercentage = this.mphTotalSupply.isZero() ? new BigNumber(0) : new BigNumber(mph.totalStakedMPHBalance).div(this.mphTotalSupply).times(100);
        this.mphTotalHistoricalReward = new BigNumber(mph.totalHistoricalReward);
      }
    }
  }

  resetData(): void {
    this.mphTotalSupply = new BigNumber(0);
    this.mphStakedPercentage = new BigNumber(0);
    this.mphTotalHistoricalReward = new BigNumber(0);
    this.totalDepositUSD = new BigNumber(0);
    this.totalInterestUSD = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

}

interface QueryResult {
  dpools: {
    id: string;
    stablecoin: string;
    totalActiveDeposit: number;
    totalInterestPaid: number;
  }[];
  mph: {
    id: string;
    totalSupply: number;
    totalStakedMPHBalance: number;
    totalHistoricalReward: number;
    rewardPerMPHPerSecond: number;
  };
}