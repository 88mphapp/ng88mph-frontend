import { Injectable } from '@angular/core';
import { ConstantsService } from './constants.service';
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import gql from 'graphql-tag';

@Injectable({
  providedIn: 'root'
})
export class TimeSeriesService {

  constructor(
    public constants: ConstantsService
  ) {
  }

  client = new ApolloClient({
    uri: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
    cache: new InMemoryCache(),
  });

  getLatestUTCDate() {
    let date = new Date();
    date.setUTCHours(0,0,0,0);
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
      timeStamps.push(startTime + (p * period));
    }

    // generate a query string
    let queryString = `query GetBlocks {`;
    for (let i = 0; i < timeStamps.length; i++) {
      queryString +=
      `t${i}: blocks(
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
    const blocksQuery = gql`${queryString}`;

    // run the query and create array of blocks
    await this.client.query<QueryResult>({
      query: blocksQuery
    }).then(results =>
      {
        for (let result in results.data) {
          blocks.push(parseInt(results.data[result][0].number));
        }
      }
    );

    // return data
    data.push(timeStamps);
    data.push(blocks);
    return data;
  }
}

interface QueryResult {
  blocks: {
    id: string;
    number: number;
    timestamp: number;
  }
}
