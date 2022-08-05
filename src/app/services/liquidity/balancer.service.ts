import { Injectable } from '@angular/core';
import { ConstantsService } from 'src/app/constants.service';
import { TimeSeriesService } from 'src/app/timeseries.service';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';

@Injectable({
  providedIn: 'root',
})
export class BalancerService {
  balancer_subgraph: string =
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2';
  balancer_protocol_fee: number = 0.5;

  balancer_pool_token: string = '0x3e09e828c716c5e2bc5034eed7d5ec8677ffba18';
  balancer_pool_token_id: string =
    '0x3e09e828c716c5e2bc5034eed7d5ec8677ffba180002000000000000000002b1';

  constructor(
    public constants: ConstantsService,
    public time: TimeSeriesService
  ) {}

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
}

interface QueryResult {
  pool: {
    totalShares: string;
    totalSwapFee: string;
    totalLiquidity: string;
  };
}
