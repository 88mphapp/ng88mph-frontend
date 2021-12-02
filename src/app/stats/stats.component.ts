import { Component, OnInit } from '@angular/core';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
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
  mphTotalSupplyEthereum: BigNumber;
  mphCirculatingSupplyEthereum: BigNumber;
  mphStakedEthereum: BigNumber;

  totalDepositPolygon: BigNumber;
  totalInterestEarnedPolygon: BigNumber;
  totalRewardPolygon: BigNumber;
  mphTotalSupplyPolygon: BigNumber;
  mphCirculatingSupplyPolygon: BigNumber;
  mphStakedPolygon: BigNumber;

  totalDepositAvalanche: BigNumber;
  totalInterestEarnedAvalanche: BigNumber;
  totalRewardAvalanche: BigNumber;
  mphTotalSupplyAvalanche: BigNumber;
  mphCirculatingSupplyAvalanche: BigNumber;
  mphStakedAvalanche: BigNumber;

  totalDepositFantom: BigNumber;
  totalInterestEarnedFantom: BigNumber;
  totalRewardFantom: BigNumber;
  mphTotalSupplyFantom: BigNumber;
  mphCirculatingSupplyFantom: BigNumber;
  mphStakedFantom: BigNumber;

  totalDepositV2: BigNumber;
  totalInterestEarnedV2: BigNumber;
  totalRewardV2: BigNumber;

  // all stats
  mphTotalSupply: BigNumber;
  mphCirculatingSupply: BigNumber;
  mphStaked: BigNumber;

  mphTotalHistoricalReward: BigNumber;
  daiTotalHistoricalReward: BigNumber;

  // settings
  displaySetting: string;

  constructor(
    public constants: ConstantsService,
    public contract: ContractService,
    public wallet: WalletService,
    public datas: DataService
  ) {
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
    // this.loadMPH(this.constants.CHAIN_ID.POLYGON);
    // this.loadMPH(this.constants.CHAIN_ID.AVALANCHE);
    this.loadMPH(this.constants.CHAIN_ID.FANTOM);
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

  async loadMPH(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const mph = this.contract.getNamedContract('MPHToken', web3, networkID);

    let mphTotalSupply: BigNumber = new BigNumber(0);
    await mph.methods
      .totalSupply()
      .call()
      .then((result) => {
        mphTotalSupply = new BigNumber(result).div(this.constants.PRECISION);
        this.mphTotalSupply = this.mphTotalSupply.plus(mphTotalSupply);
        this.mphCirculatingSupply =
          this.mphCirculatingSupply.plus(mphTotalSupply);
      });

    let mphCirculatingSupply: BigNumber = mphTotalSupply;
    if (this.constants.GOV_TREASURY[networkID] !== '') {
      await mph.methods
        .balanceOf(this.constants.GOV_TREASURY[networkID])
        .call()
        .then((result) => {
          const balance = new BigNumber(result).div(this.constants.PRECISION);
          mphCirculatingSupply = mphCirculatingSupply.minus(balance);
          this.mphCirculatingSupply = this.mphCirculatingSupply.minus(balance);
        });
    }
    if (this.constants.DEV_WALLET[networkID] !== '') {
      await mph.methods
        .balanceOf(this.constants.DEV_WALLET[networkID])
        .call()
        .then((result) => {
          const balance = new BigNumber(result).div(this.constants.PRECISION);
          mphCirculatingSupply = mphCirculatingSupply.minus(balance);
          this.mphCirculatingSupply = this.mphCirculatingSupply.minus(balance);
        });
    }
    if (this.constants.MERKLE_DISTRIBUTOR[networkID] !== '') {
      await mph.methods
        .balanceOf(this.constants.MERKLE_DISTRIBUTOR[networkID])
        .call()
        .then((result) => {
          const balance = new BigNumber(result).div(this.constants.PRECISION);
          mphCirculatingSupply = mphCirculatingSupply.minus(balance);
          this.mphCirculatingSupply = this.mphCirculatingSupply.minus(balance);
        });
    }

    let mphStaked: BigNumber = new BigNumber(0);
    await mph.methods
      .balanceOf(this.constants.XMPH_ADDRESS[networkID])
      .call()
      .then((result) => {
        mphStaked = new BigNumber(result).div(this.constants.PRECISION);
        mphCirculatingSupply = mphCirculatingSupply.minus(mphStaked);
        this.mphStaked = this.mphStaked.plus(mphStaked);
        this.mphCirculatingSupply = this.mphCirculatingSupply.minus(mphStaked);
      });

    switch (networkID) {
      case this.constants.CHAIN_ID.MAINNET:
        this.mphTotalSupplyEthereum = mphTotalSupply;
        this.mphCirculatingSupplyEthereum = mphCirculatingSupply;
        this.mphStakedEthereum = mphStaked;
        break;
      case this.constants.CHAIN_ID.POLYGON:
        this.mphTotalSupplyPolygon = mphTotalSupply;
        this.mphCirculatingSupplyPolygon = mphCirculatingSupply;
        this.mphStakedPolygon = mphStaked;
        break;
      case this.constants.CHAIN_ID.AVALANCHE:
        this.mphTotalSupplyAvalanche = mphTotalSupply;
        this.mphCirculatingSupplyAvalanche = mphCirculatingSupply;
        this.mphStakedAvalanche = mphStaked;
        break;
      case this.constants.CHAIN_ID.FANTOM:
        this.mphTotalSupplyFantom = mphTotalSupply;
        this.mphCirculatingSupplyFantom = mphCirculatingSupply;
        this.mphStakedFantom = mphStaked;
        break;
    }
  }

  resetData(): void {
    // chain stats
    this.totalDepositEthereum = new BigNumber(0);
    this.totalInterestEarnedEthereum = new BigNumber(0);
    this.totalRewardEthereum = new BigNumber(0);
    this.mphTotalSupplyEthereum = new BigNumber(0);
    this.mphCirculatingSupplyEthereum = new BigNumber(0);
    this.mphStakedEthereum = new BigNumber(0);

    this.totalDepositPolygon = new BigNumber(0);
    this.totalInterestEarnedPolygon = new BigNumber(0);
    this.totalRewardPolygon = new BigNumber(0);
    this.mphTotalSupplyPolygon = new BigNumber(0);
    this.mphCirculatingSupplyPolygon = new BigNumber(0);
    this.mphStakedPolygon = new BigNumber(0);

    this.totalDepositAvalanche = new BigNumber(0);
    this.totalInterestEarnedAvalanche = new BigNumber(0);
    this.totalRewardAvalanche = new BigNumber(0);
    this.mphTotalSupplyAvalanche = new BigNumber(0);
    this.mphCirculatingSupplyAvalanche = new BigNumber(0);
    this.mphStakedAvalanche = new BigNumber(0);

    this.totalDepositFantom = new BigNumber(0);
    this.totalInterestEarnedFantom = new BigNumber(0);
    this.totalRewardFantom = new BigNumber(0);
    this.mphTotalSupplyFantom = new BigNumber(0);
    this.mphCirculatingSupplyFantom = new BigNumber(0);
    this.mphStakedFantom = new BigNumber(0);

    this.totalDepositV2 = new BigNumber(0);
    this.totalInterestEarnedV2 = new BigNumber(0);
    this.totalRewardV2 = new BigNumber(0);

    // all stats
    this.mphTotalSupply = new BigNumber(0);
    this.mphCirculatingSupply = new BigNumber(0);
    this.mphStaked = new BigNumber(0);

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
