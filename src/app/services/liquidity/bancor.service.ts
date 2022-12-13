import { Injectable, Output, EventEmitter } from '@angular/core';

import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { TimeSeriesService } from 'src/app/timeseries.service';

import {
  BANCOR_V2_DEPLOYMENT_TIMESTAMP,
  BANCOR_V3_DEPLOYMENT_TIMESTAMP,
} from 'src/app/constants/deployments';

@Injectable({
  providedIn: 'root',
})
export class BancorService {
  @Output() loadedEvent = new EventEmitter();
  v2_liquidity: Liquidity = Object.create({});
  v3_liquidity: Liquidity = Object.create({});

  V2_DEPLOYMENT_TIMESTAMP: number = 0;
  V2_DEPLOYMENT_BLOCK: number = 0;

  // https://etherscan.io/address/0x8CDCE5c7e8738da11C66385347DcD928a3530c77
  V3_DEPLOYMENT_TIMESTAMP: number = 1654808870;
  V3_DEPLOYMENT_BLOCK: number = 14934684;

  liquidity: Dataset = Object.create({});

  constructor(
    public constants: ConstantsService,
    public helpers: HelpersService,
    public timeseries: TimeSeriesService
  ) {
    this.loadData();
  }

  loadData() {
    Promise.all([
      // this.fetchLiquidityV2(this.constants.CHAIN_ID.MAINNET),
      this.fetchLiquidityV3(this.constants.CHAIN_ID.MAINNET),
    ]).then(() => {
      this.loadedEvent.emit();
    });
  }

  async fetchLiquidityV2(networkID: number) {
    let data = [];
    let index = 0;

    const timestamps = (
      await this.timeseries.getCustomTimeSeries(
        BANCOR_V2_DEPLOYMENT_TIMESTAMP[networkID],
        this.constants.DAY_IN_SEC,
        networkID
      )
    )[0];

    while (index < timestamps.length) {
      const start_date = timestamps[index];
      const end_date =
        timestamps.length - index > 364
          ? timestamps[index + 364 - 1]
          : timestamps[timestamps.length - 1];

      const apiStr = `https://api-v2.bancor.network/history/liquidity-depth/?dlt_type=ethereum&token_dlt_id=${this.constants.MPH_ADDRESS[networkID]}&start_date=${start_date}&end_date=${end_date}&interval=day`;
      const result = await this.helpers.httpsGet(apiStr);
      data = data.concat(result.data);
      index += 364;
    }

    console.log(timestamps);
    console.log(data);

    const liquidity: number[] = [];

    for (let point in data) {
      // @dev this does not consider the MPH price
      liquidity.push(data[point] ? parseFloat(data[point].base) : 0);
    }

    this.v2_liquidity.labels = this.getReadableTimestamps(timestamps);
    this.v2_liquidity.data = liquidity;
  }

  async fetchLiquidityV3(networkID: number) {
    const [timestamps, blocks] = await this.timeseries.getCustomTimeSeries(
      this.V3_DEPLOYMENT_TIMESTAMP,
      this.constants.DAY_IN_SEC,
      networkID
    );
    console.log(blocks);

    // const apiStr = `https://api-v3.bancor.network/pools/?dlt_type=ethereum&dlt_id=${this.constants.MPH_ADDRESS[networkID]}`;
    const apiStr = `https://api-v3.bancor.network/pools/?dlt_type=ethereum&dlt_id=0x8cdce5c7e8738da11c66385347dcd928a3530c77`;
    // const apiStr = `https://api-v3.bancor.network/tokens/?dlt_type=ethereum&dlt_id=0x8888801aF4d980682e47f1A9036e589479e835C5`;
    // const apiStr = `https://api-v3.bancor.network/pools/?dlt_type=ethereum&dlt_id=0x8888801aF4d980682e47f1A9036e589479e835C5`;
    const result = await this.helpers.httpsGet(apiStr);
    console.log(result);
    // data = data.concat(result.data);

    //https://api-v3.bancor.network/pools/?dlt_type=ethereum&dlt_id=0x8888801aF4d980682e47f1A9036e589479e835C5
  }

  handleLiquidityV3() {}

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

interface Dataset {
  timestamps: number[];
  labels: string[];
  liquidity: number[];
}

interface Liquidity {
  data: number[];
  labels: string[];
}
