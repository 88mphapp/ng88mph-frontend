import { Injectable, Output, EventEmitter } from '@angular/core';
import { request, gql } from 'graphql-request';

import { ConstantsService } from 'src/app/constants.service';
import { TimeSeriesService } from 'src/app/timeseries.service';

import {
  UNISWAP_V2_DEPLOYMENT_TIMESTAMP,
  UNISWAP_V3_DEPLOYMENT_TIMESTAMP,
} from 'src/app/constants/deployments';

@Injectable({
  providedIn: 'root',
})
export class UniswapService {
  @Output() loadedEvent = new EventEmitter();
  v2_liquidity: Liquidity = Object.create({});
  v3_liquidity: Liquidity = Object.create({});

  v2_subgraph: string =
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
  v2_pool_id: string = '0x4d96369002fc5b9687ee924d458a7e5baa5df34e';

  v3_subgraph: string =
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
  v3_pool_id: string = '0xda7dd9ad1b2af1e50c73a0cc5d23ec5397478763';

  constructor(
    public constants: ConstantsService,
    public time: TimeSeriesService
  ) {
    this.loadData();
  }

  loadData() {
    Promise.all([
      this.v2_fetchLiquidity(this.constants.CHAIN_ID.MAINNET),
      this.v3_fetchLiquidity(this.constants.CHAIN_ID.MAINNET),
    ]).then(() => {
      this.loadedEvent.emit();
    });
  }

  async v2_fetchLiquidity(networkID: number) {
    const [timestamps, blocks] = await this.time.getCustomTimeSeries(
      UNISWAP_V2_DEPLOYMENT_TIMESTAMP[networkID],
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
          id: "${this.v2_pool_id}",
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

      await request(this.v2_subgraph, query)
        .then((result: QueryResult) => (data = { ...data, ...result }))
        .catch((error) => console.error(error));

      count += limit;
    }

    const liquidity: number[] = [];

    for (let point in data) {
      liquidity.push(data[point] ? parseFloat(data[point].reserveUSD) : 0);
    }

    this.v2_liquidity.labels = this.getReadableTimestamps(timestamps);
    this.v2_liquidity.data = liquidity;
  }

  async v3_fetchLiquidity(networkID: number) {
    const [timestamps, blocks] = await this.time.getCustomTimeSeries(
      UNISWAP_V3_DEPLOYMENT_TIMESTAMP[networkID],
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
        queryString += `t${i}: pool(
          id: "${this.v3_pool_id}",
          block: {
            number: ${blocks[i]}
          }
        ) {
          totalValueLockedUSD
        }`;
      }
      queryString += `}`;
      const query = gql`
        ${queryString}
      `;

      await request(this.v3_subgraph, query)
        .then((result: QueryResult) => (data = { ...data, ...result }))
        .catch((error) => console.error(error));

      count += limit;
    }

    const liquidity: number[] = [];

    for (let point in data) {
      liquidity.push(
        data[point] ? parseFloat(data[point].totalValueLockedUSD) : 0
      );
    }

    this.v3_liquidity.labels = this.getReadableTimestamps(timestamps);
    this.v3_liquidity.data = liquidity;
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
  pool: {
    totalValueLockedUSD: number;
  };
}

interface Liquidity {
  data: number[];
  labels: string[];
}
