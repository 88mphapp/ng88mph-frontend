import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import BigNumber from 'bignumber.js';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app//helpers.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-net-interest-margin',
  templateUrl: './net-interest-margin.component.html',
  styleUrls: ['./net-interest-margin.component.css']
})
export class NetInterestMarginComponent implements OnInit {

  // constants
  FIRST_INDEX: number = 1606262400;
  PERIOD: number = this.constants.WEEK_IN_SEC;
  COLORS: string[] = [
    "44, 123, 229",
    "255, 103, 155",
    "107, 94, 174",
    "114, 124, 245",
    "230, 55, 87",
    "253, 126, 20",
    "246, 195, 67",
    "0, 217, 126",
    "2, 168, 181",
    "57, 175, 209"
  ];

  // data variables
  timeseriesdata: number[][] = [];
  timestamps: number[] = [];
  readable: string[] = [];
  blocks: number[] = [];
  data: Array<DataObject> = [];

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
    public timeseries: TimeSeriesService,
    public contract: ContractService
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
      responsive: true,
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
    this.barChartData = this.data;
  }

  async loadData() {
    // wait to fetch timeseries data
    this.timeseriesdata =  await this.timeseries.getCustomTimeSeries(this.FIRST_INDEX, this.PERIOD);

    // populate timestamps and blocks arrays
    this.timestamps = this.timeseriesdata[0];
    this.blocks = this.timeseriesdata[1];
    // transform timestamps to readable format
    let readable: string[] = [];
    for (let i in this.timestamps) {
      readable.push((new Date(this.timestamps[i]*1000)).toLocaleString("en-US", {month: "short", day: "numeric"}));
    }
    this.readable = readable;

    // then generate the query
    let queryString = `query InterestExpense {`;
      queryString +=
      `dpools {
        id
        address
        totalActiveDeposit
        oneYearInterestRate
      }`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString +=
      `t${i}: deposits(
        first: 1000
        block: {
          number: ${this.blocks[i]}
        }
        where: {
          active: true
        }
      ) {
        pool {
          address
          totalActiveDeposit
          oneYearInterestRate
        }
        amount
        interestEarned
        depositTimestamp
        maturationTimestamp
        fundingID
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
      let result = queryResult.data;
      let dpools = result.dpools;

      // build empty data structure
      for (let i in dpools) {
        let dataobj: DataObject;
        dataobj = {
          label: dpools[i].id,
          data: [],
          interestEarned: [],
          interestExpenses: [],
          totalDeposits: [],
          borderColor: "rgba(" + (this.COLORS[parseInt(i) % this.COLORS.length]) + ", 0.5)",
          fill: false
        }
        this.data.push(dataobj);
      }

      // populate data structure
      for (let i in result) {

        if (i !== "dpools") {
          // initialize dpool data arrays
          for (let i in this.data) {
            if(this.data[i].label) {
              this.data[i].interestEarned.push(0);
              this.data[i].interestExpenses.push(0);
              this.data[i].totalDeposits.push(0);
            }
          }

          for (let d in result[i]) {
            let deposit = result[i][d];
            let entry = this.data.find(x => x.label === deposit.pool.address);
            let periods = (deposit.maturationTimestamp - deposit.depositTimestamp) / this.PERIOD;
            let totalOwed = parseFloat(deposit.interestEarned);
            let periodOwed = totalOwed / periods;
            let periodEarned = parseFloat(deposit.pool.totalActiveDeposit) * (parseFloat(deposit.pool.oneYearInterestRate) / (this.constants.YEAR_IN_SEC / this.PERIOD));
            entry.interestExpenses[parseInt(i.substring(1))] += periodOwed;
            if (entry.totalDeposits[parseInt(i.substring(1))] === 0) {
              entry.totalDeposits[parseInt(i.substring(1))] = parseFloat(deposit.pool.totalActiveDeposit);
            }
            if (entry.interestEarned[parseInt(i.substring(1))] === 0) {
              entry.interestEarned[parseInt(i.substring(1))] = periodEarned;
            }
          }

          // data relies on oneYearInterestRate, which doesn't support historical queries
          // it currently does not account for the 30-day EMA as the value has changed over time
          // so, this data is incorrect based on those two datapoints
          for (let i in this.data) {
            if(this.data[i].label) {
              for (let t = 0; t < this.blocks.length; t++) {
                let earnings = this.data[i].interestEarned[t];
                let expenses = this.data[i].interestExpenses[t];
                let deposits = this.data[i].totalDeposits[t];
                let data = (earnings - expenses) * (this.constants.YEAR_IN_SEC / this.PERIOD) / deposits;
                if (isNaN(data)) {
                  this.data[i].data[t] = 0;
                } else {
                  this.data[i].data[t] = data * 100;
                }
              }
            }
          }
        }
      }

      // get human readable labels
      for (let i in this.data) {
        if(this.data[i].label) {
          let poolInfo = this.contract.getPoolInfoFromAddress(this.data[i].label);
          let name = poolInfo.name;
          this.data[i].label = name;
        }
      }
    }
  }
}

interface QueryResult {
  deposits: {
    pool: string;
    amount: number;
    interestEarned: number;
    depositTimestamp: number;
    maturationTimestamp: number;
    fundingID: number;
  }[];
  dpools: {
    id: string;
    address: string;
    totalActiveDeposit: number;
    oneYearInterestRate: number;
  }[];
}

interface DataObject {
  label: string;
  data: Array<number>;
  interestEarned: Array<number>;
  interestExpenses: Array<number>;
  totalDeposits: Array<number>;
  borderColor: string;
  fill: any;
}
