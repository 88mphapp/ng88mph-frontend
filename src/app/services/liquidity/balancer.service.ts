import { Injectable } from '@angular/core';
import { Output, EventEmitter } from '@angular/core';
import { ConstantsService } from 'src/app/constants.service';
import { TimeSeriesService } from 'src/app/timeseries.service';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { BALANCER_DEPLOYMENT_TIMESTAMP } from 'src/app/constants/deployments';

@Injectable({
  providedIn: 'root',
})
export class BalancerService {
  @Output() loadedEvent = new EventEmitter();

  balancer_subgraph: string =
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2';
  balancer_protocol_fee: number = 0.5;

  balancer_pool_token: string = '0x3e09e828c716c5e2bc5034eed7d5ec8677ffba18';
  balancer_pool_token_id: string =
    '0x3e09e828c716c5e2bc5034eed7d5ec8677ffba180002000000000000000002b1';

  liquidity: Liquidity = Object.create({});

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

  ////////////////////////////////////////////////////////////
  // @notice Fetches historical liquidity data.
  ////////////////////////////////////////////////////////////
  async fetchLiquidity(networkID: number) {
    const [timestamps, blocks] = await this.time.getCustomTimeSeries(
      BALANCER_DEPLOYMENT_TIMESTAMP[networkID],
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
          id: "${this.balancer_pool_token_id}",
          block: {
            number: ${blocks[i]}
          }
        ) {
          totalLiquidity
        }`;
      }
      queryString += `}`;
      const query = gql`
        ${queryString}
      `;

      await request(this.balancer_subgraph, query)
        .then((result: QueryResult) => (data = { ...data, ...result }))
        .catch((error) => console.error(error));

      count += limit;
    }

    const liquidity: number[] = [];

    for (let point in data) {
      liquidity.push(data[point] ? parseFloat(data[point].totalLiquidity) : 0);
    }

    this.liquidity.labels = this.getReadableTimestamps(timestamps);
    this.liquidity.data = liquidity;
  }

  ////////////////////////////////////////////////////////////
  // @notice Calculates the BPT price in USD on Mainnet.
  ////////////////////////////////////////////////////////////
  async calcBptPrice(): Promise<BigNumber> {
    const queryString = gql`
      {
        pool(
          id: "${this.balancer_pool_token_id}"
        ) {
          totalShares
          totalLiquidity
        }
      }
    `;
    return request(this.balancer_subgraph, queryString).then(
      (data: QueryResult) => {
        const shares = new BigNumber(data.pool.totalShares);
        const liquidity = new BigNumber(data.pool.totalLiquidity);
        return liquidity.div(shares);
      }
    );
  }

  ////////////////////////////////////////////////////////////
  // @notice Calculates the swap fee APR on Mainnet.
  //
  // @dev Based on 24 hour swap fee accumulation. Balancer may display a
  // different APR because their time travel query is based on static block
  // times and is less accurate.
  ////////////////////////////////////////////////////////////
  async calcSwapFeeApr(): Promise<BigNumber> {
    const now = Math.floor(Date.now() / 1e3);
    const block = await this.time.getBlock(
      now - this.constants.DAY_IN_SEC,
      this.constants.CHAIN_ID.MAINNET
    );

    const queryString = gql`
      {
        today: pool(
          id: "${this.balancer_pool_token_id}"
        ) {
          totalSwapFee
          totalLiquidity
        }
        yesterday: pool(
          id: "${this.balancer_pool_token_id}",
          block: {
            number: ${block}
          }
        ) {
          totalSwapFee
        }
      }
    `;
    return request(this.balancer_subgraph, queryString).then(
      (data: QueryResult) => {
        const liquidity = new BigNumber(data['today'].totalLiquidity);
        const swap_fee_today = new BigNumber(data['today'].totalSwapFee);
        const swap_fee_yesterday = new BigNumber(
          data['yesterday'].totalSwapFee
        );

        const apr = swap_fee_today
          .minus(swap_fee_yesterday)
          .times(1 - this.balancer_protocol_fee)
          .div(liquidity)
          .times(365)
          .times(100);
        return apr;
      }
    );
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
  pool: {
    totalShares: string;
    totalSwapFee: string;
    totalLiquidity: string;
  };
}

interface Liquidity {
  data: number[];
  labels: string[];
}
