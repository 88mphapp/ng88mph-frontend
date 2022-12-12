import { Injectable, Output, EventEmitter } from '@angular/core';
import { request, gql } from 'graphql-request';

import { ConstantsService } from 'src/app/constants.service';
import { TimeSeriesService } from 'src/app/timeseries.service';

import { SUSHISWAP_DEPLOYMENT_TIMESTAMP } from 'src/app/constants/deployments';

@Injectable({
  providedIn: 'root',
})
export class SushiswapService {
  @Output() loadedEvent = new EventEmitter();
  liquidity: Liquidity = Object.create({});

  subgraph: string =
    'https://api.thegraph.com/subgraphs/name/sushiswap/exchange';
  pool_id: string = '0xb2c29e311916a346304f83aa44527092d5bd4f0f';

  constructor(
    public constants: ConstantsService,
    public time: TimeSeriesService
  ) {
    this.loadData();
  }

  loadData() {
    Promise.all([this.fetchLiquidity(this.constants.CHAIN_ID.MAINNET)]).then(
      () => {
        this.loadedEvent.emit();
      }
    );
  }

  async fetchLiquidity(networkID: number) {
    const [timestamps, blocks] = await this.time.getCustomTimeSeries(
      SUSHISWAP_DEPLOYMENT_TIMESTAMP[networkID],
      this.constants.DAY_IN_SEC,
      networkID
    );

    let data: QueryResult = Object.create({});

    let count: number = 0;
    while (count < blocks.length) {
      let limit = blocks.length - count;
      if (limit > 250) {
        // @dev adjust the limit to prevent 413 errors
        limit = 250;
      }

      let queryString = `query Liquidity {`;
      for (let i = count; i < count + limit; i++) {
        queryString += `t${i}: pair(
          id: "${this.pool_id}",
          block: {
            number: ${blocks[i]}
          }
        ) {
          reserveUSD
        }`;
      }
      queryString += `}`;
      const query = gql`
        ${queryString}
      `;

      await request(this.subgraph, query)
        .then((result: QueryResult) => (data = { ...data, ...result }))
        .catch((error) => console.error(error));

      count += limit;
    }

    const liquidity: number[] = [];

    for (let point in data) {
      liquidity.push(data[point] ? parseFloat(data[point].reserveUSD) : 0);
    }

    this.liquidity.labels = this.getReadableTimestamps(timestamps);
    this.liquidity.data = liquidity;
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
  pair: {
    reserveUSD: number;
  };
}

interface Liquidity {
  data: number[];
  labels: string[];
}
