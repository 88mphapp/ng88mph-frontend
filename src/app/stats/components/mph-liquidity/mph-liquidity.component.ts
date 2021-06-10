import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import BigNumber from 'bignumber.js';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app//helpers.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-mph-liquidity',
  templateUrl: './mph-liquidity.component.html',
  styleUrls: ['./mph-liquidity.component.css']
})
export class MphLiquidityComponent implements OnInit {

  FIRST_INDEX: number = 1605744000;
  PERIOD: number = this.constants.DAY_IN_SEC;

  // data variables
  timeseriesdata: number[][] = [];
  timestamps: number[] = [];
  readable: string[] = [];
  blocks: number[] = [];
  uniswap: number[] = [];
  sushiswap: number[] = [];
  bancor: number[] = [];

  // chart variables
  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(
    private apollo: Apollo,
    public helpers: HelpersService,
    public constants: ConstantsService,
    public timeseries: TimeSeriesService
  ) {

  }

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
          xAxes: [{
            stacked: true,
            gridLines: {
              display: false
            }
          }],
          yAxes: [{
            stacked: true,
            gridLines: {
              display: true,
              color: "#242526"
            }
          }]
      }
    };
    this.barChartLabels = this.readable;
    this.barChartType = 'bar';
    this.barChartLegend = false;
    this.barChartData = [
      {
      data: this.uniswap,
      label: "Uniswap",
      backgroundColor: "rgba(221, 107, 229, 0.3)",
      borderColor: "rgba(221, 107, 229, 1)",
      hoverBackgroundColor: "rgba(221, 107, 229, 1)"
      },
      {
        data: this.sushiswap,
        label: "Sushiswap",
        backgroundColor: "rgba(3, 184, 255, 0.3)",
        borderColor: "rgba(3, 184, 255, 1)",
        hoverBackgroundColor: "rgba(3, 184, 255, 1)"
      },
      {
        data: this.bancor,
        label: "Bancor",
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderColor: "rgba(255, 255, 255, 1)",
        hoverBackgroundColor: "rgba(255, 255, 255, 1)"
      }
    ];
  }

  async loadData() {

    // wait to fetch timeseries data
    this.timeseriesdata =  await this.timeseries.getCustomTimeSeries(this.FIRST_INDEX, this.PERIOD);

    // populate timestamps, blocks, and readable arrays
    this.timestamps = this.timeseriesdata[0];
    this.blocks = this.timeseriesdata[1];

    // transform timestamps to readable format
    let readable: string[] = [];
    for (let i in this.timestamps) {
      readable.push((new Date(this.timestamps[i]*1000)).toLocaleString("en-US", {month: "short", day: "numeric"}));
    }
    this.readable = readable;

    // load data
    this.loadUniswap();
    this.loadSushiswap();
    this.loadBancor();

  }

  async loadUniswap() {
    const uniswap = new ApolloClient({
      uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
      cache: new InMemoryCache(),
    });

    // buld the query string
    let queryString = `query Uniswap {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString +=
      `t${i}: pair(
        id: "0x4d96369002fc5b9687ee924d458a7e5baa5df34e",
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        reserveUSD
      }`;
    }
    queryString += `}`;
    const query = gql`${queryString}`;

    uniswap.query<QueryResult>({
      query: query
    }).then(result =>
      this.handleUniswapData(result)
    );
  }

  async loadSushiswap() {
    const sushiswap = new ApolloClient({
      uri: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
      cache: new InMemoryCache(),
    });

    // buld the query string
    let queryString = `query Uniswap {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString +=
      `t${i}: pair(
        id: "0xb2c29e311916a346304f83aa44527092d5bd4f0f",
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        reserveUSD
      }`;
    }
    queryString += `}`;
    const query = gql`${queryString}`;

    sushiswap.query<QueryResult>({
      query: query
    }).then(result =>
      this.handleSushiswapData(result)
    );
  }

  async loadBancor() {
    // waiting on Bancor to implement historical data queries to their API
  }

  handleUniswapData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      let result = queryResult.data;
      for(let i in result) {
        if (result[i] !== null) {
          this.uniswap.push(parseInt(result[i].reserveUSD));
        } else {
          this.uniswap.push(0);
        }
      }
    }
  }

  handleSushiswapData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      let result = queryResult.data;
      for(let i in result) {
        if (result[i] !== null) {
          this.sushiswap.push(parseInt(result[i].reserveUSD));
        } else {
          this.sushiswap.push(0);
        }

      }
    }
  }

}

interface QueryResult {
  pair: {
    reserveUSD: number;
  }
}
