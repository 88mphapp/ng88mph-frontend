import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { Chart } from 'chart.js';


@Component({
  selector: 'app-historical-staking-rewards',
  templateUrl: './historical-staking-rewards.component.html',
  styleUrls: ['./historical-staking-rewards.component.css']
})

export class HistoricalStakingRewardsComponent implements OnInit {

  // constants
  FIRST_INDEX: number = 1606176000;

  // data variables
  timeseriesdata: number[][] = [];
  timestamps: number[] = [];
  readable: string[] = [];
  blocks: number[] = [];
  data: number[] = [];

  // chart variables
  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(
    private apollo: Apollo,
    public constants: ConstantsService,
    public timeseries: TimeSeriesService
  ) {

  }

  ngOnInit(): void {
    this.drawChart();
  }

  async drawChart() {
    // wait for data to load
    await this.loadData();

    // then draw the chart
    this.barChartOptions = {
      scaleShowVerticalLines: false,
      responsive: true
    };
    this.barChartLabels = this.readable;
    this.barChartType = 'bar';
    this.barChartLegend = true;
    this.barChartData = [
      {data: this.data, label: 'Historical Staking Rewards'}
    ];
  }

  async loadData() {

    // wait to fetch timeseries data
    this.timeseriesdata =  await this.timeseries.getCustomTimeSeries(this.FIRST_INDEX, this.constants.WEEK_IN_SEC);

    // populate timestamps and blocks arrays
    this.timestamps = this.timeseriesdata[0];
    this.blocks = this.timeseriesdata[1];

    // transfor timestamps to readable format
    let newstamps: string[] = [];
    for (let i in this.timestamps) {
      newstamps.push((new Date(this.timestamps[i]*1000)).toLocaleString("en-US", {month: "short", day: "numeric", year: "numeric"}));
    }
    console.log(newstamps);
    this.readable = newstamps;

    // then generate the query
    let queryString = `query HistoricalStakingRewards {`;
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

    // then run the query
    this.apollo.query<QueryResult>({
      query: query
    }).subscribe(result =>
      this.handleData(result)
    );

  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      let rewards = queryResult.data;
      console.log(rewards);
      for (let i in rewards) {
        if(rewards[i] != null) {
          this.data.push(parseInt(rewards[i].totalHistoricalReward));
        } else {
          this.data.push(0);
        }
      }
    }
  }

  toDate() {

  }

}

interface QueryResult {
  mph: {
    id: string;
    totalHistoricalReward: number;
    rewardPerSecond: number;
    rewardPerMPHPerSecond: number;
  }
}
