import { Injectable } from '@angular/core';
import { ConstantsService } from './constants.service';
import { request, gql } from 'graphql-request';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root',
})
export class TimeSeriesService {
  constructor(
    public constants: ConstantsService,
    public wallet: WalletService
  ) {}

  getLatestUTCDate() {
    let date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime() / 1000;
  }

  calcNumPeriods(start: number, end: number, period: number) {
    let interval = end - start + 1;
    return interval / period;
  }

  async getCustomTimeSeries(customStart: number, customPeriod: number) {
    let timeStamps: number[] = [];
    let blocks: number[] = [];
    let data: number[][] = [];

    let startTime: number = customStart;
    let endTime: number = this.getLatestUTCDate();
    let period: number = customPeriod;
    let numPeriods: number = this.calcNumPeriods(startTime, endTime, period);

    // generate array of timestamps
    for (let p = 0; p < numPeriods; p++) {
      timeStamps.push(startTime + p * period);
    }

    // generate a query string
    let queryString = `query GetBlocks {`;
    for (let i = 0; i < timeStamps.length; i++) {
      queryString += `t${i}: blocks(
        first: 1,
        orderBy: timestamp,
        orderDirection: asc,
        where: {
          timestamp_gt: ${timeStamps[i]},
          timestamp_lt: ${timeStamps[i] + 600}
        }
      ) {
        id
        number
        timestamp
      }`;
    }
    queryString += `}`;
    const blocksQuery = gql`
      ${queryString}
    `;

    // run the query and create array of blocks
    await request(
      this.constants.BLOCKS_GRAPHQL_ENDPOINT[this.wallet.networkID],
      blocksQuery
    ).then((data) => {
      for (let block in data) {
        blocks.push(parseInt(data[block][0].number));
        blocks.sort(function (a, b) {
          return a - b;
        });
      }
    });

    // return data
    data.push(timeStamps);
    data.push(blocks);
    return data;
  }
}
