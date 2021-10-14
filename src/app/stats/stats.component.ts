import { Component, OnInit, NgZone } from '@angular/core';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css'],
})
export class StatsComponent implements OnInit {
  mphTotalSupply: BigNumber;
  mphStakedPercentage: BigNumber;
  mphTotalHistoricalReward: BigNumber;
  totalDepositUSD: BigNumber;
  totalInterestDistributedUSD: BigNumber;
  totalInterestOwedUSD: BigNumber;
  mphPriceUSD: BigNumber;
  mphCirculatingSupply: BigNumber;

  constructor(
    public helpers: HelpersService,
    public constants: ConstantsService,
    public wallet: WalletService,
    private zone: NgZone
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData(this.wallet.networkID);
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData();
        this.loadData(networkID);
      });
    });
  }

  async loadData(networkID: number) {
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
    await request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => this.handleData(data, networkID));

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    const requestNetworkID =
      networkID === this.constants.CHAIN_ID.RINKEBY
        ? networkID
        : this.constants.CHAIN_ID.MAINNET;

    const mphQueryString = gql`
      {
        mph (id: "0") {
          totalSupply
        }
        mphholders (
          where: {
            id_in: [
              "${this.constants.XMPH_ADDRESS[requestNetworkID].toLowerCase()}",
              "${this.constants.GOV_TREASURY[requestNetworkID].toLowerCase()}",
              "${this.constants.DEV_WALLET[requestNetworkID].toLowerCase()}",
              "${this.constants.MERKLE_DISTRIBUTOR[
                requestNetworkID
              ].toLowerCase()}",
            ]
          }
        ) {
          address
          mphBalance
        }
      }
    `;
    request(
      this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[requestNetworkID],
      mphQueryString
    ).then((data: QueryResult) => {
      const mph = data.mph;
      const mphholders = data.mphholders;

      this.mphTotalSupply = new BigNumber(mph.totalSupply);
      this.mphStakedPercentage = new BigNumber(
        mphholders.find(
          (holder) =>
            holder.address ===
            this.constants.XMPH_ADDRESS[requestNetworkID].toLowerCase()
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

  async handleData(data: QueryResult, networkID: number) {
    // bail if a chain change has occured
    if (networkID !== this.wallet.networkID) {
      return;
    }

    const dpools = data.dpools;
    const rewards = data.globalStats;

    if (rewards) {
      this.mphTotalHistoricalReward = new BigNumber(
        rewards.xMPHRewardDistributed
      );
    }

    if (dpools) {
      let totalDepositUSD = new BigNumber(0);
      let totalInterestDistributedUSD = new BigNumber(0);
      let totalInterestOwedUSD = new BigNumber(0);
      let stablecoinPriceCache = {};
      Promise.all(
        dpools.map(async (pool) => {
          let stablecoinPrice = stablecoinPriceCache[pool.stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(
              pool.stablecoin,
              this.wallet.networkID
            );
            stablecoinPriceCache[pool.stablecoin] = stablecoinPrice;
          }
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
        this.totalDepositUSD = totalDepositUSD;
        this.totalInterestDistributedUSD = totalInterestDistributedUSD;
        this.totalInterestOwedUSD = totalInterestOwedUSD;
      });
    }
  }

  resetData(): void {
    this.mphTotalSupply = new BigNumber(0);
    this.mphStakedPercentage = new BigNumber(0);
    this.mphTotalHistoricalReward = new BigNumber(0);
    this.totalDepositUSD = new BigNumber(0);
    this.totalInterestDistributedUSD = new BigNumber(0);
    this.totalInterestOwedUSD = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
    this.mphCirculatingSupply = new BigNumber(0);
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
