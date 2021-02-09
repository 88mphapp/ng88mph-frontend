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

  async loadData() {
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
          id
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

    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const mphToken = this.contract.getNamedContract('MPHToken', readonlyWeb3);
    const rewards = this.contract.getNamedContract('Rewards', readonlyWeb3);
    this.mphTotalSupply = new BigNumber(await mphToken.methods.totalSupply().call()).div(this.constants.PRECISION);
    this.mphStakedPercentage = this.mphTotalSupply.isZero() ? new BigNumber(0) : new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION).div(this.mphTotalSupply).times(100);

    // compute circulating supply
    let mphCirculatingSupply = this.mphTotalSupply;
    const getBalance = async address => {
      return new BigNumber(await mphToken.methods.balanceOf(address).call()).div(this.constants.PRECISION);
    }
    const accountsToUpdate = [
      this.contract.getNamedContractAddress('Farming'),
      this.constants.GOV_TREASURY,
      this.constants.DEV_WALLET,
      this.constants.MPH_MERKLE_DISTRIBUTOR,
      this.contract.getNamedContractAddress('Rewards'),
      this.contract.getNamedContractAddress('Vesting')
    ];
    const accountBalances = await Promise.all(accountsToUpdate.map(account => getBalance(account)));
    for (const balance of accountBalances) {
      mphCirculatingSupply = mphCirculatingSupply.minus(balance);
    }
    this.mphCirculatingSupply = mphCirculatingSupply;
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
            const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
            const poolInterestUSD = this.helpers.applyFeeToInterest(new BigNumber(pool.totalInterestPaid).times(stablecoinPrice), poolInfo);
            totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
            totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
          })
        ).then(() => {
          this.totalDepositUSD = totalDepositUSD;
          this.totalInterestUSD = totalInterestUSD;
        });
      }

      if (mph) {
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
    this.mphCirculatingSupply = new BigNumber(0);
  }

}

interface QueryResult {
  dpools: {
    id: string;
    address: string;
    stablecoin: string;
    totalActiveDeposit: number;
    totalInterestPaid: number;
  }[];
  mph: {
    id: string;
    totalHistoricalReward: number;
    rewardPerMPHPerSecond: number;
  };
}