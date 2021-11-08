import { Component, OnInit } from '@angular/core';
import { ConstantsService } from '../constants.service';
import { DataService } from '../data.service';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css'],
})
export class StatsComponent implements OnInit {
  // chain stats
  totalDepositEthereum: BigNumber;
  totalInterestEarnedEthereum: BigNumber;
  totalRewardEthereum: BigNumber;

  totalDepositPolygon: BigNumber;
  totalInterestEarnedPolygon: BigNumber;
  totalRewardPolygon: BigNumber;

  totalDepositAvalanche: BigNumber;
  totalInterestEarnedAvalanche: BigNumber;
  totalRewardAvalanche: BigNumber;

  totalDepositFantom: BigNumber;
  totalInterestEarnedFantom: BigNumber;
  totalRewardFantom: BigNumber;

  totalDepositV2: BigNumber;
  totalInterestEarnedV2: BigNumber;
  totalRewardV2: BigNumber;

  // mph
  mphTotalSupply: BigNumber;
  mphCirculatingSupply: BigNumber;
  mphStakedPercentage: BigNumber;
  mphTotalHistoricalReward: BigNumber;
  daiTotalHistoricalReward: BigNumber;

  // settings
  displaySetting: string;

  constructor(public constants: ConstantsService, public datas: DataService) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll() {
    this.loadData(this.constants.CHAIN_ID.MAINNET);
    this.loadData(this.constants.CHAIN_ID.POLYGON);
    this.loadData(this.constants.CHAIN_ID.AVALANCHE);
    this.loadData(this.constants.CHAIN_ID.FANTOM);
    this.loadV2(this.constants.CHAIN_ID.MAINNET);
    this.loadMPH(this.constants.CHAIN_ID.MAINNET);
  }

  loadData(networkID: number) {
    const queryString = gql`
      {
        dpools {
          id
          address
          stablecoin
          totalDeposit
          totalInterestOwed
          historicalInterestPaid
        }
        globalStats(id: "0") {
          xMPHRewardDistributed
        }
      }
    `;
    request(this.constants.GRAPHQL_ENDPOINT[networkID], queryString).then(
      (data: QueryResult) => this.handleData(data, networkID)
    );
  }

  async handleData(data: QueryResult, networkID: number) {
    const dpools = data.dpools;
    const rewards = data.globalStats;

    if (rewards) {
      const reward = new BigNumber(rewards.xMPHRewardDistributed);

      switch (networkID) {
        case this.constants.CHAIN_ID.MAINNET:
          this.totalRewardEthereum = reward;
          break;
        case this.constants.CHAIN_ID.POLYGON:
          this.totalRewardPolygon = reward;
          break;
        case this.constants.CHAIN_ID.AVALANCHE:
          this.totalRewardAvalanche = reward;
          break;
        case this.constants.CHAIN_ID.FANTOM:
          this.totalRewardFantom = reward;
          break;
      }

      this.mphTotalHistoricalReward =
        this.mphTotalHistoricalReward.plus(reward);
    }

    if (dpools) {
      let totalDepositUSD = new BigNumber(0);
      let totalInterestDistributedUSD = new BigNumber(0);
      let totalInterestOwedUSD = new BigNumber(0);
      Promise.all(
        dpools.map(async (pool) => {
          const stablecoinPrice = await this.datas.getAssetPriceUSD(
            pool.stablecoin,
            networkID
          );
          const poolDepositUSD = new BigNumber(pool.totalDeposit).times(
            stablecoinPrice
          );
          const poolInterestDistributedUSD = new BigNumber(
            pool.historicalInterestPaid
          ).times(stablecoinPrice);
          const poolInterestOwedUSD = new BigNumber(
            pool.totalInterestOwed
          ).times(stablecoinPrice);

          totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
          totalInterestDistributedUSD = totalInterestDistributedUSD.plus(
            poolInterestDistributedUSD
          );
          totalInterestOwedUSD = totalInterestOwedUSD.plus(poolInterestOwedUSD);
        })
      ).then(() => {
        switch (networkID) {
          case this.constants.CHAIN_ID.MAINNET:
            this.totalDepositEthereum = totalDepositUSD;
            this.totalInterestEarnedEthereum =
              totalInterestDistributedUSD.plus(totalInterestOwedUSD);
            break;
          case this.constants.CHAIN_ID.POLYGON:
            this.totalDepositPolygon = totalDepositUSD;
            this.totalInterestEarnedPolygon =
              totalInterestDistributedUSD.plus(totalInterestOwedUSD);
            break;
          case this.constants.CHAIN_ID.AVALANCHE:
            this.totalDepositAvalanche = totalDepositUSD;
            this.totalInterestEarnedAvalanche =
              totalInterestDistributedUSD.plus(totalInterestOwedUSD);
            break;
          case this.constants.CHAIN_ID.FANTOM:
            this.totalDepositFantom = totalDepositUSD;
            this.totalInterestEarnedFantom =
              totalInterestDistributedUSD.plus(totalInterestOwedUSD);
            break;
        }
      });
    }
  }

  async loadV2(networkID: number) {
    const queryString = gql`
      {
        dpools {
          id
          address
          stablecoin
          totalActiveDeposit
          totalInterestPaid
        }
        mph(id: "0") {
          totalHistoricalReward
        }
      }
    `;
    request(this.constants.GRAPHQL_ENDPOINT_V2[networkID], queryString).then(
      (data: QueryResultV2) => {
        const dpools = data.dpools;
        const rewards = data.mph;

        if (rewards) {
          this.totalRewardV2 = new BigNumber(rewards.totalHistoricalReward);
          this.daiTotalHistoricalReward = this.daiTotalHistoricalReward.plus(
            rewards.totalHistoricalReward
          );
        }

        if (dpools) {
          let totalDepositUSD = new BigNumber(0);
          let totalInterestEarnedUSD = new BigNumber(0);
          Promise.all(
            dpools.map(async (pool) => {
              const stablecoinPrice = await this.datas.getAssetPriceUSD(
                pool.stablecoin,
                networkID
              );
              const poolDepositUSD = new BigNumber(
                pool.totalActiveDeposit
              ).times(stablecoinPrice);
              const poolInterestPaidUSD = new BigNumber(
                pool.totalInterestPaid
              ).times(stablecoinPrice);
              totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
              totalInterestEarnedUSD =
                totalInterestEarnedUSD.plus(poolInterestPaidUSD);
            })
          ).then(() => {
            this.totalDepositV2 = totalDepositUSD;
            this.totalInterestEarnedV2 = totalInterestEarnedUSD;
          });
        }
      }
    );
  }

  loadMPH(networkID: number) {
    const mphQueryString = gql`
      {
        mph (id: "0") {
          totalSupply
        }
        mphholders (
          where: {
            id_in: [
              "${this.constants.XMPH_ADDRESS[networkID].toLowerCase()}",
              "${this.constants.GOV_TREASURY[networkID].toLowerCase()}",
              "${this.constants.DEV_WALLET[networkID].toLowerCase()}",
              "${this.constants.MERKLE_DISTRIBUTOR[networkID].toLowerCase()}",
            ]
          }
        ) {
          address
          mphBalance
        }
      }
    `;
    request(
      this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[networkID],
      mphQueryString
    ).then((data: QueryResult) => {
      const mph = data.mph;
      const mphholders = data.mphholders;

      this.mphTotalSupply = new BigNumber(mph.totalSupply);
      this.mphStakedPercentage = new BigNumber(
        mphholders.find(
          (holder) =>
            holder.address ===
            this.constants.XMPH_ADDRESS[networkID].toLowerCase()
        ).mphBalance
      )
        .div(this.mphTotalSupply)
        .times(100);

      let circulatingSupply = this.mphTotalSupply;
      for (let h in mphholders) {
        const holder = mphholders[h];
        const mphBalance = new BigNumber(holder.mphBalance);
        circulatingSupply = circulatingSupply.minus(mphBalance);
      }
      this.mphCirculatingSupply = circulatingSupply;
    });
  }

  resetData(): void {
    // chain stats
    this.totalDepositEthereum = new BigNumber(0);
    this.totalInterestEarnedEthereum = new BigNumber(0);
    this.totalRewardEthereum = new BigNumber(0);

    this.totalDepositPolygon = new BigNumber(0);
    this.totalInterestEarnedPolygon = new BigNumber(0);
    this.totalRewardPolygon = new BigNumber(0);

    this.totalDepositAvalanche = new BigNumber(0);
    this.totalInterestEarnedAvalanche = new BigNumber(0);
    this.totalRewardAvalanche = new BigNumber(0);

    this.totalDepositFantom = new BigNumber(0);
    this.totalInterestEarnedFantom = new BigNumber(0);
    this.totalRewardFantom = new BigNumber(0);

    this.totalDepositV2 = new BigNumber(0);
    this.totalInterestEarnedV2 = new BigNumber(0);
    this.totalRewardV2 = new BigNumber(0);

    // mph
    this.mphTotalSupply = new BigNumber(0);
    this.mphCirculatingSupply = new BigNumber(0);
    this.mphStakedPercentage = new BigNumber(0);
    this.mphTotalHistoricalReward = new BigNumber(0);
    this.daiTotalHistoricalReward = new BigNumber(0);

    // settings
    this.displaySetting = 'all';
  }
}

interface QueryResult {
  dpools: {
    id: string;
    address: string;
    stablecoin: string;
    totalDeposit: number;
    totalInterestOwed: number;
    historicalInterestPaid: number;
  }[];
  globalStats: {
    xMPHRewardDistributed: string;
  };
  mph: {
    totalSupply: string;
  };
  mphholders: {
    address: string;
    mphBalance: string;
  }[];
}

interface QueryResultV2 {
  dpools: {
    id: string;
    address: string;
    stablecoin: string;
    totalActiveDeposit: string;
    totalInterestPaid: string;
  }[];
  mph: {
    totalHistoricalReward: string;
  };
}
