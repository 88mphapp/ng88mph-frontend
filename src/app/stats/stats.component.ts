import { Component, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
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
  totalInterestUSD: BigNumber;
  mphPriceUSD: BigNumber;
  mphCirculatingSupply: BigNumber;

  constructor(
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
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData();
      this.loadData();
    });
  }

  async loadData() {
    const queryString = gql`
      {
        dpools {
          id
          address
          stablecoin
          totalDeposit
        }
        globalStats(id: "0") {
          xMPHRewardDistributed
        }
      }
    `;
    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => this.handleData(data));

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    const mph = this.contract.getContract(
      this.constants.MPH_ADDRESS[this.wallet.networkID],
      `MPHToken`
    );

    const xmph = await this.contract.getContract(
      this.constants.XMPH_ADDRESS[this.wallet.networkID],
      `xMPH`
    );

    await mph.methods
      .totalSupply()
      .call()
      .then((totalSupply) => {
        this.mphTotalSupply = new BigNumber(totalSupply).div(
          this.constants.PRECISION
        );
      });

    mph.methods
      .balanceOf(xmph.options.address)
      .call()
      .then((stakedBalance) => {
        this.mphStakedPercentage = new BigNumber(stakedBalance)
          .div(this.mphTotalSupply)
          .div(this.constants.PRECISION)
          .times(100);
      });

    // compute circulating supply
    let mphCirculatingSupply = this.mphTotalSupply;
    const getBalance = async (address) => {
      if (address !== '') {
        return new BigNumber(await mph.methods.balanceOf(address).call()).div(
          this.constants.PRECISION
        );
      } else {
        return new BigNumber(0);
      }
    };
    const accountsToUpdate = [
      this.constants.XMPH_ADDRESS[this.wallet.networkID],
      this.constants.GOV_TREASURY[this.wallet.networkID],
      this.constants.DEV_WALLET[this.wallet.networkID],
      this.constants.MERKLE_DISTRIBUTOR[this.wallet.networkID],
    ];
    const accountBalances = await Promise.all(
      accountsToUpdate.map((account) => getBalance(account))
    );
    for (const balance of accountBalances) {
      mphCirculatingSupply = mphCirculatingSupply.minus(balance);
    }
    this.mphCirculatingSupply = mphCirculatingSupply;
  }

  async handleData(data: QueryResult) {
    const dpools = data.dpools;
    const rewards = data.globalStats;

    if (rewards) {
      this.mphTotalHistoricalReward = new BigNumber(
        rewards.xMPHRewardDistributed
      );
    }

    if (dpools) {
      let totalDepositUSD = new BigNumber(0);
      let stablecoinPriceCache = {};
      Promise.all(
        dpools.map(async (pool) => {
          let stablecoinPrice = stablecoinPriceCache[pool.stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(
              pool.stablecoin
            );
            stablecoinPriceCache[pool.stablecoin] = stablecoinPrice;
          }
          const poolDepositUSD = new BigNumber(pool.totalDeposit).times(
            stablecoinPrice
          );
          totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
        })
      ).then(() => {
        this.totalDepositUSD = totalDepositUSD;
      });
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
    address: string;
    stablecoin: string;
    totalDeposit: number;
  }[];
  globalStats: {
    xMPHRewardDistributed: string;
  };
}
