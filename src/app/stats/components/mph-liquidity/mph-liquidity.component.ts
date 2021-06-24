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
  FIRST_INDEX: number = 1605744000;
  PERIOD: number = this.constants.DAY_IN_SEC;

  // data variables
  timeseriesdata: number[][] = [];
  timestamps: number[] = [];
  readable: string[] = [];
  blocks: number[] = [];
  uniswap_v2: number[] = [];
  sushiswap: number[] = [];
  bancor: number[] = [];

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
    this.drawChart();
  }

  async drawChart() {
    await this.loadData();

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

  async loadData() {
    // wait to fetch timeseries data
    this.timeseriesdata = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX,
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

    // load data
    this.loadUniswapV2();
    this.loadSushiswap();
    this.loadBancor();
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

  async loadSushiswap() {
    // buld the query string
    let queryString = `query Uniswap {`;
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
    // waiting on Bancor to implement historical data queries to their API
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
}

interface QueryResult {
  pair: {
    reserveUSD: number;
  };
}
