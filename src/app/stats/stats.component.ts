import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import CoinGecko from 'coingecko-api';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css']
})
export class StatsComponent implements OnInit {
  mphTotalSupply: BigNumber;
  mphStakedPercentage: BigNumber;
  mphTotalHistoricalReward: BigNumber;
  coinGeckoClient: CoinGecko;
  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;

  constructor(private apollo: Apollo) {
    this.coinGeckoClient = new CoinGecko();

    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const queryString = gql`
      {
        dpools {
          stablecoin
          totalActiveDeposit
          totalInterestPaid
        }
        mph(id: "0") {
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
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const dpools = queryResult.data.dpools;
      const mph = queryResult.data.mph;

      if (dpools) {
        let totalDepositUSD = new BigNumber(0);
        let totalInterestUSD = new BigNumber(0);
        let stablecoinPriceCache = {};
        for (const pool of dpools) {
          let stablecoinPrice = stablecoinPriceCache[pool.stablecoin];
          if (!stablecoinPrice) {
            const rawData = await this.coinGeckoClient.coins.fetchCoinContractMarketChart(pool.stablecoin, 'ethereum', {
              days: 0
            });
            if (rawData.success) {
              stablecoinPrice = rawData.data.prices[0][1];
            } else {
              stablecoinPrice = 0;
            }
            stablecoinPriceCache[pool.stablecoin] = stablecoinPrice;
          }

          const poolDepositUSD = new BigNumber(pool.totalActiveDeposit).times(stablecoinPrice);
          const poolInterestUSD = new BigNumber(pool.totalInterestPaid).times(stablecoinPrice);
          totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
          totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
        }
        this.totalDepositUSD = totalDepositUSD;
        this.totalInterestUSD = totalInterestUSD;
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
  }

}

interface QueryResult {
  dpools: {
    stablecoin: string;
    totalActiveDeposit: number;
    totalInterestPaid: number;
  }[];
  mph: {
    totalSupply: number;
    totalStakedMPHBalance: number;
    totalHistoricalReward: number;
    rewardPerMPHPerSecond: number;
  };
}