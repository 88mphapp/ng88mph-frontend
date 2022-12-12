import { Injectable, Output, EventEmitter } from '@angular/core';
import { request, gql } from 'graphql-request';

import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';

import { DEPLOYMENT_TIMESTAMP } from 'src/app/constants/deployments';

@Injectable({
  providedIn: 'root',
})
export class ChartsService {
  @Output() loadedEvent = new EventEmitter();

  avalanche: Dataset = Object.create({});
  mainnet: Dataset = Object.create({});
  polygon: Dataset = Object.create({});
  fantom: Dataset = Object.create({});

  constructor(
    public constants: ConstantsService,
    public timeseries: TimeSeriesService
  ) {
    this.loadData();
  }

  loadData() {
    Promise.all([
      this.fetchDataset(this.constants.CHAIN_ID.AVALANCHE),
      this.fetchDataset(this.constants.CHAIN_ID.MAINNET),
      this.fetchDataset(this.constants.CHAIN_ID.POLYGON),
      this.fetchDataset(this.constants.CHAIN_ID.FANTOM),
    ]).then(() => {
      this.loadedEvent.emit();
    });
  }

  async fetchDataset(networkID: number) {
    const [timestamps, blocks] = await this.timeseries.getCustomTimeSeries(
      DEPLOYMENT_TIMESTAMP[networkID],
      this.constants.DAY_IN_SEC,
      networkID
    );

    let data: QueryResult = Object.create({});

    let count: number = 0;
    while (count < blocks.length) {
      let limit = blocks.length - count;
      if (limit > 300) {
        // @dev adjust the limit to prevent 413 errors
        limit = 300;
      }

      let queryString = `query Dataset {`;
      for (let i = count; i < count + limit; i++) {
        queryString += `t${i}: protocol(
          id: "0",
          block: {
            number: ${blocks[i]}
          }
        ) {
          totalDepositUSD
          totalInterestOwedUSD
          totalFeeOwedUSD
          totalFundedAmountUSD
          totalSurplusUSD
        }`;
      }
      queryString += `}`;
      const query = gql`
        ${queryString}
      `;

      await request(this.constants.GRAPHQL_ENDPOINT[networkID], query)
        .then((result: QueryResult) => (data = { ...data, ...result }))
        .catch((error) => console.error(error));

      count += limit;
    }

    this.handleDataset(data, timestamps, networkID);
  }

  handleDataset(data: QueryResult, timestamps: number[], networkID: number) {
    const deposits: number[] = [];
    const interestExpense: number[] = [];
    const fundedInterestExpense: number[] = [];

    const loanLossReserve: number[] = [];

    for (let point in data) {
      deposits.push(data[point] ? parseFloat(data[point].totalDepositUSD) : 0);

      // interest expense
      const interest =
        data[point] && parseFloat(data[point].totalInterestOwedUSD);
      const funded =
        data[point] && parseFloat(data[point].totalFundedAmountUSD);
      const fee = data[point] && parseFloat(data[point].totalFeeOwedUSD);
      interestExpense.push(data[point] ? interest + fee : 0);
      fundedInterestExpense.push(data[point] ? funded : 0);

      // loan loss reserve
      const surplus = data[point] && parseFloat(data[point].totalSurplusUSD);
      loanLossReserve.push(data[point] ? surplus : 0);
    }

    switch (networkID) {
      case this.constants.CHAIN_ID.AVALANCHE:
        this.avalanche.timestamps = timestamps;
        this.avalanche.labels = this.getReadableTimestamps(timestamps);

        this.avalanche.deposits = deposits;
        this.avalanche.interestExpense = interestExpense;
        this.avalanche.fundedInterestExpense = fundedInterestExpense;

        this.avalanche.loanLossReserve = loanLossReserve;

        break;
      case this.constants.CHAIN_ID.MAINNET:
        this.mainnet.timestamps = timestamps;
        this.mainnet.labels = this.getReadableTimestamps(timestamps);

        this.mainnet.deposits = deposits;
        this.mainnet.interestExpense = interestExpense;
        this.mainnet.fundedInterestExpense = fundedInterestExpense;

        this.mainnet.loanLossReserve = loanLossReserve;

        break;
      case this.constants.CHAIN_ID.POLYGON:
        this.polygon.timestamps = timestamps;
        this.polygon.labels = this.getReadableTimestamps(timestamps);

        this.polygon.deposits = deposits;
        this.polygon.interestExpense = interestExpense;
        this.polygon.fundedInterestExpense = fundedInterestExpense;

        this.polygon.loanLossReserve = loanLossReserve;

        break;
      case this.constants.CHAIN_ID.FANTOM:
        this.fantom.timestamps = timestamps;
        this.fantom.labels = this.getReadableTimestamps(timestamps);

        this.fantom.deposits = deposits;
        this.fantom.interestExpense = interestExpense;
        this.fantom.fundedInterestExpense = fundedInterestExpense;

        this.fantom.loanLossReserve = loanLossReserve;

        break;
    }
  }

  getReadableTimestamps(timestamps: number[]): string[] {
    let readable: string[] = [];
    for (let i in timestamps) {
      readable.push(
        new Date(timestamps[i] * 1000).toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'short',
          day: 'numeric',
        })
      );
    }
    return readable;
  }
}

interface QueryResult {
  protocol: {
    totalDepositUSD: string;
    totalInterestOwedUSD: string;
    totalFeeOwedUSD: string;
    totalFundedAmountUSD: string;
    totalSurplusUSD: string;
  };
}

interface Dataset {
  timestamps: number[];
  labels: string[];

  deposits: number[]; // principal amount of deposits
  interestExpense: number[]; // interest + fee owed on deposits
  fundedInterestExpense: number[]; // interest + fee funded by yield token holders

  loanLossReserve: number[]; // reserve value after all depositors, funders, and fees have been paid (protocol excess)
}
