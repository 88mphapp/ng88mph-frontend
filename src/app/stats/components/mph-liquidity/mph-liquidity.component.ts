import { Component, OnInit } from '@angular/core';
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
  };
  PERIOD: number = this.constants.DAY_IN_SEC;
  PERIOD_NAME: string = 'daily';

  // data variables
  timeseriesdata: number[][];
  timestamps: number[];
  readable: string[];
  blocks: number[];
  uniswap_v2: number[];
  uniswap_v3: number[];
  sushiswap: number[];
  bancor: number[];
  loading: boolean;

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
    public timeseries: TimeSeriesService
  ) {}

  ngOnInit(): void {
    this.resetChart();
    this.drawChart();
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
    this.loading = true;
  }

  async drawChart() {
    // wait for data to load
    await this.loadData(this.constants.CHAIN_ID.MAINNET);

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
            ticks: {
              autoSkip: true,
              autoSkipPadding: 5,
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
            scaleLabel: {
              display: true,
              labelString: 'Millions (USD)',
            },
            ticks: {
              min: 0,
              callback: function (label, index, labels) {
                const x = label / 1e6;
                const y =
                  '$' +
                  x
                    .toFixed(0)
                    .toString()
                    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return y;
              },
            },
          },
        ],
      },
      tooltips: {
        callbacks: {
          label: function (tooltipItem, data) {
            const index = tooltipItem.datasetIndex;
            const dexLabel = data.datasets[index].label;
            const item = tooltipItem.yLabel.toFixed(0);
            const formattedItem =
              '$' + item.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return dexLabel + ': ' + formattedItem;
          },
        },
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

  async loadData(networkID: number) {
    // wait to fetch timeseries data
    this.timeseriesdata = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX[networkID],
      this.PERIOD,
      networkID
    );

    // populate timestamps, blocks, and readable arrays
    this.timestamps = this.timeseriesdata[0];
    this.blocks = this.timeseriesdata[1];

    // transform timestamps to readable format
    let readable: string[] = [];
    for (let i in this.timestamps) {
      readable.push(
        new Date(this.timestamps[i] * 1000).toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'short',
          day: 'numeric',
        })
      );
    }
    this.readable = readable;

    // load dex data
    await Promise.all([
      this.loadUniswapV2(networkID),
      this.loadUniswapV3(networkID),
      this.loadSushiswap(networkID),
      this.loadBancor(networkID),
    ]).then(() => {
      this.loading = false;
    });
  }

  async loadUniswapV2(networkID: number) {
    // buld the query string
    let queryString = `query Uniswap_V2 {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: pair(
        id: "${this.constants.UNISWAP_V2_LP[networkID]}",
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

    await request(this.constants.UNISWAP_V2_GRAPHQL_ENDPOINT, query).then(
      (data: QueryResult) => this.handleUniswapV2Data(data)
    );
  }

  async loadUniswapV3(networkID: number) {
    let queryString = `query Uniswap_V3 {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: pool(
        id: "${this.constants.UNISWAP_V3_LP[networkID]}",
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
    await request(this.constants.UNISWAP_V3_GRAPHQL_ENDPOINT, query).then(
      (data: QueryResult) => this.handleUniswapV3Data(data)
    );
  }

  async loadSushiswap(networkID: number) {
    // buld the query string
    let queryString = `query Sushiswap {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: pair(
        id: "${this.constants.SUSHISWAP_LP[networkID]}",
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

    await request(this.constants.SUSHISWAP_GRAPHQL_ENDPOINT, query).then(
      (data: QueryResult) => this.handleSushiswapData(data)
    );
  }

  async loadBancor(networkID: number) {
    let data = [];
    let bookmark = 0;

    while (bookmark < this.timestamps.length) {
      const start_date = this.timestamps[bookmark];
      const end_date =
        this.timestamps.length - bookmark > 360
          ? this.timestamps[bookmark + 360 - 1]
          : this.timestamps[this.timestamps.length - 1];

      const apiStr = `https://api-v2.bancor.network/history/liquidity-depth/?dlt_type=ethereum&token_dlt_id=${this.constants.MPH_ADDRESS[networkID]}&start_date=${start_date}&end_date=${end_date}&interval=day`;
      const result = await this.helpers.httpsGet(apiStr);
      data = data.concat(result.data);
      bookmark += 360;
    }

    this.handleBancorData(data, networkID);
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

  async handleBancorData(data: Array<BancorNetworkHistory>, networkID: number) {
    const days =
      (this.timeseries.getLatestUTCDate() -
        this.FIRST_INDEX[networkID] +
        this.constants.DAY_IN_SEC) /
      this.constants.DAY_IN_SEC;
    let mphPriceData = await this.helpers.getHistoricalTokenPriceUSD(
      this.constants.MPH_ADDRESS[networkID],
      `${days}`,
      this.blocks,
      this.timestamps,
      networkID
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

  changePeriod(name: string) {
    this.PERIOD_NAME = name;
    if (this.PERIOD_NAME === 'daily') {
      this.PERIOD = this.constants.DAY_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1605744000,
      };
    } else if (this.PERIOD_NAME === 'weekly') {
      this.PERIOD = this.constants.WEEK_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1605398400,
      };
    } else if (this.PERIOD_NAME === 'monthly') {
      this.PERIOD = this.constants.MONTH_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1604188800,
      };
    }

    this.resetChart();
    this.drawChart();
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
