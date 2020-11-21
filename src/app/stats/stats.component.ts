import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';

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
  mphCirculatingSupply: BigNumber;

  constructor(
    private apollo: Apollo,
    public helpers: HelpersService,
    public contract: ContractService,
    public constants: ConstantsService,
    public wallet: WalletService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
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
        lpPool: mphholder(id: "${this.contract.getNamedContractAddress('Farming').toLowerCase()}") {
          id
          mphBalance
        }
        govTreasury: mphholder(id: "${this.constants.GOV_TREASURY.toLowerCase()}") {
          id
          mphBalance
        }
        devWallet: mphholder(id: "${this.constants.DEV_WALLET.toLowerCase()}") {
          id
          mphBalance
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
      const lpPool = queryResult.data.lpPool;
      const govTreasury = queryResult.data.govTreasury;
      const devWallet = queryResult.data.devWallet;

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

      let mphCirculatingSupply = this.mphTotalSupply;
      if (lpPool) {
        mphCirculatingSupply = mphCirculatingSupply.minus(lpPool.mphBalance);
      }
      if (govTreasury) {
        mphCirculatingSupply = mphCirculatingSupply.minus(govTreasury.mphBalance);
      }
      if (devWallet) {
        mphCirculatingSupply = mphCirculatingSupply.minus(devWallet.mphBalance);
      }
      this.mphCirculatingSupply = mphCirculatingSupply;
    }
  }

  resetData(): void {
    this.mphTotalSupply = new BigNumber(0);
    this.mphStakedPercentage = new BigNumber(0);
    this.mphTotalHistoricalReward = new BigNumber(0);
    this.totalDepositUSD = new BigNumber(0);
    this.totalInterestUSD = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
    this.mphCirculatingSupply = new BigNumber(0);
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
  lpPool: {
    id: string;
    mphBalance: number;
  };
  govTreasury: {
    id: string;
    mphBalance: number;
  };
  devWallet: {
    id: string;
    mphBalance: number;
  };
}