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

  async getCustomTimeSeries(
    customStart: number,
    customPeriod: number,
    networkID: number = this.wallet.networkID
  ) {
    let timeStamps: number[] = [];
    let blocks: number[] = [];
    let data: number[][] = [];

    let startTime: number = customStart;
    let endTime: number = this.getLatestUTCDate();

    if (customPeriod === this.constants.MONTH_IN_SEC) {
      let current: number = customStart;
      let end: number = endTime;
      while (end >= current) {
        timeStamps.push(current);

        let seconds = 0;
        let date = new Date(current * 1000);
        let month = date.getUTCMonth();

        if (month == 0) {
          // january
          seconds = this.constants.DAY_IN_SEC * 31;
        } else if (month == 1) {
          // february
          let year = date.getUTCFullYear();
          if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {
            seconds = this.constants.DAY_IN_SEC * 29; // leap year
          } else {
            seconds = this.constants.DAY_IN_SEC * 28; // normal year
          }
        } else if (month == 2) {
          // march
          seconds = this.constants.DAY_IN_SEC * 31;
        } else if (month == 3) {
          // april
          seconds = this.constants.DAY_IN_SEC * 30;
        } else if (month == 4) {
          // may
          seconds = this.constants.DAY_IN_SEC * 31;
        } else if (month == 5) {
          // june
          seconds = this.constants.DAY_IN_SEC * 30;
        } else if (month == 6) {
          // july
          seconds = this.constants.DAY_IN_SEC * 31;
        } else if (month == 7) {
          // august
          seconds = this.constants.DAY_IN_SEC * 31;
        } else if (month == 8) {
          // september
          seconds = this.constants.DAY_IN_SEC * 30;
        } else if (month == 9) {
          // october
          seconds = this.constants.DAY_IN_SEC * 31;
        } else if (month == 10) {
          // november
          seconds = this.constants.DAY_IN_SEC * 30;
        } else if (month == 11) {
          // december
          seconds = this.constants.DAY_IN_SEC * 31;
        }

        current += seconds;
      }
    } else {
      let period: number = customPeriod;
      let numPeriods: number = this.calcNumPeriods(startTime, endTime, period);
      for (let p = 0; p < numPeriods; p++) {
        timeStamps.push(startTime + p * period);
      }
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
      this.constants.BLOCKS_GRAPHQL_ENDPOINT[networkID],
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
