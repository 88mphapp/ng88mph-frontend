import { Injectable } from '@angular/core';
import { request, gql } from 'graphql-request';
import BigNumber from 'bignumber.js';

import { ConstantsService } from 'src/app/constants.service';

@Injectable({
  providedIn: 'root',
})
export class StatisticsService {
  deposits: Statistic = Object.create({});
  interest: Statistic = Object.create({});
  fee: Statistic = Object.create({});

  debt: Statistic = Object.create({});
  funded: Statistic = Object.create({});
  surplus: Statistic = Object.create({});

  constructor(public constants: ConstantsService) {
    this.resetData();
    this.loadData();
  }

  resetData() {
    this.deposits.avalanche = new BigNumber(0);
    this.deposits.mainnet = new BigNumber(0);
    this.deposits.polygon = new BigNumber(0);
    this.deposits.fantom = new BigNumber(0);
    this.deposits.all = new BigNumber(0);

    this.interest.avalanche = new BigNumber(0);
    this.interest.mainnet = new BigNumber(0);
    this.interest.polygon = new BigNumber(0);
    this.interest.fantom = new BigNumber(0);
    this.interest.all = new BigNumber(0);

    this.fee.avalanche = new BigNumber(0);
    this.fee.mainnet = new BigNumber(0);
    this.fee.polygon = new BigNumber(0);
    this.fee.fantom = new BigNumber(0);
    this.fee.all = new BigNumber(0);

    this.debt.avalanche = new BigNumber(0);
    this.debt.mainnet = new BigNumber(0);
    this.debt.polygon = new BigNumber(0);
    this.debt.fantom = new BigNumber(0);
    this.debt.all = new BigNumber(0);

    this.funded.avalanche = new BigNumber(0);
    this.funded.mainnet = new BigNumber(0);
    this.funded.polygon = new BigNumber(0);
    this.funded.fantom = new BigNumber(0);
    this.funded.all = new BigNumber(0);

    this.surplus.avalanche = new BigNumber(0);
    this.surplus.mainnet = new BigNumber(0);
    this.surplus.polygon = new BigNumber(0);
    this.surplus.fantom = new BigNumber(0);
    this.surplus.all = new BigNumber(0);
  }

  loadData() {
    this.fetchStatistics(this.constants.CHAIN_ID.AVALANCHE);
    this.fetchStatistics(this.constants.CHAIN_ID.MAINNET);
    this.fetchStatistics(this.constants.CHAIN_ID.POLYGON);
    this.fetchStatistics(this.constants.CHAIN_ID.FANTOM);
  }

  fetchStatistics(networkID: number) {
    const query = gql`
      {
        protocol(id: "0") {
          totalDepositUSD
          totalInterestOwedUSD
          totalFeeOwedUSD
          totalFundedAmountUSD
          totalSurplusUSD
          historicalInterestPaidUSD
          historicalFeePaidUSD
        }
      }
    `;

    request(this.constants.GRAPHQL_ENDPOINT[networkID], query)
      .then((data: QueryResult) => this.handleStatistics(data, networkID))
      .catch((error) => console.error(error));
  }

  handleStatistics(data: QueryResult, networkID: number) {
    const info = data.protocol;

    const deposits = new BigNumber(info.totalDepositUSD);
    const interest = new BigNumber(info.historicalInterestPaidUSD);
    const fee = new BigNumber(info.historicalFeePaidUSD);

    const debt = new BigNumber(info.totalInterestOwedUSD).plus(
      info.totalFeeOwedUSD
    );
    const funded = new BigNumber(info.totalFundedAmountUSD);
    const surplus = new BigNumber(info.totalSurplusUSD);

    // update the aggregate variables
    this.deposits.all = this.deposits.all.plus(deposits);
    this.interest.all = this.interest.all.plus(interest);
    this.fee.all = this.fee.all.plus(fee);

    this.debt.all = this.debt.all.plus(debt);
    this.funded.all = this.funded.all.plus(funded);
    this.surplus.all = this.surplus.all.plus(surplus);

    // update the network variables
    switch (networkID) {
      case this.constants.CHAIN_ID.AVALANCHE:
        this.deposits.avalanche = deposits;
        this.interest.avalanche = interest;
        this.fee.avalanche = fee;

        this.debt.avalanche = debt;
        this.funded.avalanche = funded;
        this.surplus.avalanche = surplus;
        break;
      case this.constants.CHAIN_ID.MAINNET:
        this.deposits.mainnet = deposits;
        this.interest.mainnet = interest;
        this.fee.mainnet = fee;

        this.debt.mainnet = debt;
        this.funded.mainnet = funded;
        this.surplus.mainnet = surplus;
        break;
      case this.constants.CHAIN_ID.POLYGON:
        this.deposits.polygon = deposits;
        this.interest.polygon = interest;
        this.fee.polygon = fee;

        this.debt.polygon = debt;
        this.funded.polygon = funded;
        this.surplus.polygon = surplus;
        break;
      case this.constants.CHAIN_ID.FANTOM:
        this.deposits.fantom = deposits;
        this.interest.fantom = interest;
        this.fee.fantom = fee;

        this.debt.fantom = debt;
        this.funded.fantom = funded;
        this.surplus.fantom = surplus;
        break;
    }
  }
}

interface QueryResult {
  protocol: {
    totalDepositUSD: string;
    totalInterestOwedUSD: string;
    totalFeeOwedUSD: string;
    totalFundedAmountUSD: string;
    totalSurplusUSD: string;
    historicalInterestPaidUSD: string;
    historicalFeePaidUSD: string;
  };
}

interface Statistic {
  avalanche: BigNumber;
  mainnet: BigNumber;
  polygon: BigNumber;
  fantom: BigNumber;
  all: BigNumber;
}
