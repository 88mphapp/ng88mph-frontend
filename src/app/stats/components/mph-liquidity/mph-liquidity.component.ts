import { Component, OnInit, NgZone } from '@angular/core';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app//helpers.service';
import { WalletService } from 'src/app//wallet.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-mph-liquidity',
  templateUrl: './mph-liquidity.component.html',
  styleUrls: ['./mph-liquidity.component.css'],
})
export class MphLiquidityComponent implements OnInit {
  FIRST_INDEX = {
    [this.constants.CHAIN_ID.MAINNET]: 1605744000,
    [this.constants.CHAIN_ID.RINKEBY]: 1624406400,
  };
  PERIOD: number = this.constants.DAY_IN_SEC;

  // data variables
  timeseriesdata: number[][];
  timestamps: number[];
  readable: string[];
  blocks: number[];
  uniswap_v2: number[];
  uniswap_v3: number[];
  sushiswap: number[];
  bancor: number[];

  // chart variables
  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(
    public helpers: HelpersService,
    public constants: ConstantsService,
    public wallet: WalletService,
    public timeseries: TimeSeriesService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.resetChart();
    this.drawChart(this.wallet.networkID);
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetChart();
        this.drawChart(networkID);
      });
    });
  }

  resetChart() {
    this.timeseriesdata = [];
    this.timestamps = [];
    this.readable = [];
    this.blocks = [];
    this.uniswap_v2 = [];
    this.uniswap_v3 = [];
    this.sushiswap = [];
    this.bancor = [];
  }

  async drawChart(networkID: number) {
    // wait for data to load
    const loaded = await this.loadData(networkID);
    if (!loaded) return;

    // then draw the chart
    this.barChartOptions = {
      scaleShowVerticalLines: false,
      responsive: true,
      scales: {
        xAxes: [
          {
            stacked: true,
            gridLines: {
              display: false,
            },
          },
        ],
        yAxes: [
          {
            stacked: true,
            gridLines: {
              display: true,
              color: '#242526',
            },
          },
        ],
      },
    };
    this.barChartLabels = this.readable;
    this.barChartType = 'bar';
    this.barChartLegend = false;
    this.barChartData = [
      {
        data: this.uniswap_v2,
        label: 'Uniswap V2',
        backgroundColor: 'rgba(221, 107, 229, 0.3)',
        borderColor: 'rgba(221, 107, 229, 1)',
        hoverBackgroundColor: 'rgba(221, 107, 229, 1)',
      },
      {
        data: this.uniswap_v3,
        label: 'Uniswap V3',
        backgroundColor: 'rgba(75, 179, 154, 0.3)',
        borderColor: 'rgba(75, 179, 154, 1)',
        hoverBackgroundColor: 'rgba(75, 179, 154, 1)',
      },
      {
        data: this.sushiswap,
        label: 'Sushiswap',
        backgroundColor: 'rgba(3, 184, 255, 0.3)',
        borderColor: 'rgba(3, 184, 255, 1)',
        hoverBackgroundColor: 'rgba(3, 184, 255, 1)',
      },
      {
        data: this.bancor,
        label: 'Bancor',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderColor: 'rgba(255, 255, 255, 1)',
        hoverBackgroundColor: 'rgba(255, 255, 255, 1)',
      },
    ];
  }

  async loadData(networkID: number): Promise<boolean> {
    // wait to fetch timeseries data
    this.timeseriesdata = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX[this.wallet.networkID],
      this.PERIOD
    );

    // populate timestamps, blocks, and readable arrays
    this.timestamps = this.timeseriesdata[0];
    this.blocks = this.timeseriesdata[1];

    // transform timestamps to readable format
    let readable: string[] = [];
    for (let i in this.timestamps) {
      readable.push(
        new Date(this.timestamps[i] * 1000).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      );
    }
    this.readable = readable;

    // bail if a chain change has occured
    if (networkID !== this.wallet.networkID) {
      return false;
    }

    // load data
    this.loadUniswapV2();
    this.loadUniswapV3();
    this.loadSushiswap();
    this.loadBancor();

    return true;
  }

  async loadUniswapV2() {
    // buld the query string
    let queryString = `query Uniswap_V2 {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: pair(
        id: "${this.constants.UNISWAP_V2_LP[this.wallet.networkID]}",
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        reserveUSD
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    request(this.constants.UNISWAP_V2_GRAPHQL_ENDPOINT, query).then(
      (data: QueryResult) => this.handleUniswapV2Data(data)
    );
  }

  async loadUniswapV3() {
    let queryString = `query Uniswap_V3 {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: pool(
        id: "${this.constants.UNISWAP_V3_LP[this.wallet.networkID]}",
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        totalValueLockedUSD
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;
    request(this.constants.UNISWAP_V3_GRAPHQL_ENDPOINT, query).then(
      (data: QueryResult) => this.handleUniswapV3Data(data)
    );
  }

  async loadSushiswap() {
    // buld the query string
    let queryString = `query Sushiswap {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: pair(
        id: "${this.constants.SUSHISWAP_LP[this.wallet.networkID]}",
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        reserveUSD
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    request(this.constants.SUSHISWAP_GRAPHQL_ENDPOINT, query).then(
      (data: QueryResult) => this.handleSushiswapData(data)
    );
  }

  async loadBancor() {
    if (this.wallet.networkID !== this.constants.CHAIN_ID.MAINNET) {
      return;
    }
    const start_date = this.timestamps[0];
    const end_date = this.timestamps[this.timestamps.length - 1];
    const apiStr = `https://api-v2.bancor.network/history/liquidity-depth/?dlt_type=ethereum&token_dlt_id=${
      this.constants.MPH_ADDRESS[this.wallet.networkID]
    }&start_date=${start_date}&end_date=${end_date}&interval=day`;
    const result = await this.helpers.httpsGet(apiStr);

    this.handleBancorData(result.data);
  }

  handleUniswapV2Data(data: QueryResult): void {
    for (let key in data) {
      if (data[key] !== null) {
        this.uniswap_v2[parseInt(key.substring(1))] = parseInt(
          data[key].reserveUSD
        );
      } else {
        this.uniswap_v2[parseInt(key.substring(1))] = 0;
      }
    }
  }

  handleUniswapV3Data(data: QueryResult): void {
    for (let key in data) {
      if (data[key] !== null) {
        this.uniswap_v3[parseInt(key.substring(1))] = parseInt(
          data[key].totalValueLockedUSD
        );
      } else {
        this.uniswap_v3[parseInt(key.substring(1))] = 0;
      }
    }
  }

  handleSushiswapData(data: QueryResult): void {
    for (let key in data) {
      if (data[key] !== null) {
        this.sushiswap[parseInt(key.substring(1))] = parseInt(
          data[key].reserveUSD
        );
      } else {
        this.sushiswap[parseInt(key.substring(1))] = 0;
      }
    }
  }

  async handleBancorData(data: Array<BancorNetworkHistory>) {
    const days =
      (this.timeseries.getLatestUTCDate() -
        this.FIRST_INDEX[this.wallet.networkID] +
        this.constants.DAY_IN_SEC) /
      this.constants.DAY_IN_SEC;
    let mphPriceData = await this.helpers.getHistoricalTokenPriceUSD(
      this.constants.MPH_ADDRESS[this.wallet.networkID],
      `${days}`
    );

    for (let time in this.timestamps) {
      const entry = data.find(
        (key) => key.timestamp === this.timestamps[time] * 1e3
      );
      const mphPrice = mphPriceData.find(
        (key) => key[0] === this.timestamps[time] * 1e3
      );
      if (entry && mphPrice) {
        this.bancor[parseInt(time) + 1] = parseInt(
          (entry.base * mphPrice[1]).toFixed(0)
        );
      } else {
        this.bancor[parseInt(time) + 1] = 0;
      }
    }
  }
}

interface BancorNetworkHistory {
  timestamp: number;
  bnt: number;
  eth: number;
  usd: number;
  eur: number;
  eos: number;
  base: number;
}

interface QueryResult {
  pair: {
    reserveUSD: number;
  };
  pool: {
    totalValueLockedUSD: number;
  };
}
