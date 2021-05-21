import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import BigNumber from 'bignumber.js';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app//helpers.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-historical-mph-pe-ratio',
  templateUrl: './historical-mph-pe-ratio.component.html',
  styleUrls: ['./historical-mph-pe-ratio.component.css']
})
export class HistoricalMphPeRatioComponent implements OnInit {

  // constants
  FIRST_INDEX: number = 1609372800; // Jan 1 2021 @ 00:00 UTC
  PERIOD: number = this.constants.MONTH_IN_SEC;

  // data variables
  timeseriesdata: number[][] = [];
  timestamps: number[] = [];
  readable: string[] = [];
  blocks: number[] = [];
  data: number[] = [];
  mphData: number[] = [];
  rewardData: number[] = [];

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
    // wait to load PE data
    await this.loadData();

    // then draw the chart
    this.barChartOptions = {
      scaleShowVerticalLines: false,
      responsive: true,
      point: {
        backgroundColor: 'blue'
      },
      scales: {
          xAxes: [{
            gridLines: {
              display: false
            }
          }],
          yAxes: [{
            gridLines: {
              display: true,
              color: "#242526"
            }
          }]
      }
    };
    this.barChartLabels = this.readable;
    this.barChartType = 'line';
    this.barChartLegend = false;
    this.barChartData = [
      {
        data: this.data,
        backgroundColor: "rgba(107, 94, 174, 0.3)",
        borderColor: "rgba(107, 94, 174, 0.3)",
        pointBackgroundColor: "rgba(107, 94, 174, 0.3)",
        pointBorderColor: "rgba(107, 94, 174, 1)",
        pointHoverBackgroundColor: "rgba(107, 94, 174, 1)",
        pointHoverBorderColor: "rgba(107, 94, 174, 1)"
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

    // fetch data and calculate PE ratio
    await this.getMPHPriceData();
    await this.getRewardData();
  }

  async getRewardData() {
    // build the query string
    let queryString = `query HistoricalRewards {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString +=
      `t${i}: mph(
        id: "0",
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        totalHistoricalReward
      }`;
    }
    queryString += `}`;
    const query = gql`${queryString}`;

    // query the subgraph and process the result
    this.apollo.query<QueryResult>({
      query: query
    }).subscribe(result =>
      this.handleData(result)
    );
  }

  async getMPHPriceData() {
    // query Coingecko API for historical MPH market cap data
    let days = (this.timeseries.getLatestUTCDate() - this.FIRST_INDEX + this.constants.DAY_IN_SEC) / this.constants.DAY_IN_SEC;
    let apiResult = await this.helpers.getHistoricalMPHMarketCap(`${days}`);

    // process the results into an array
    for (let t in this.timestamps) {
      let datapoint = apiResult.find(marketCap => marketCap[0] === this.timestamps[t] * 1000);
      if (datapoint) {
        this.mphData.push(datapoint[1]);
      }
    }
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      let result = queryResult.data;

      // get monthly cumulative rewards
      for (let r in result) {
        this.rewardData.push(parseInt(result[r].totalHistoricalReward));
      }

      // calculate monthly rewards and annualize them
      for(let i = this.rewardData.length - 1; i > 0; i--) {
        this.rewardData[i] -= this.rewardData[i-1];
        this.rewardData[i] *= 12;
      }
      this.rewardData[0] *= 12;

      // set precision for readability
      for (let i = 0; i < this.rewardData.length; i++) {
        let pe = this.mphData[i] / this.rewardData[i];
        this.data.push(parseFloat(pe.toPrecision(4)));
      }
    }
  }

}

interface QueryResult {
  mph: {
    totalHistoricalReward: number;
  }
}
