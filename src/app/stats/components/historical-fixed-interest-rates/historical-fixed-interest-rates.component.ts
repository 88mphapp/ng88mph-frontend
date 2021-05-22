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
  selector: 'app-historical-fixed-interest-rates',
  templateUrl: './historical-fixed-interest-rates.component.html',
  styleUrls: ['./historical-fixed-interest-rates.component.css']
})
export class HistoricalFixedInterestRatesComponent implements OnInit {

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
    let queryString = `query HistoricalFixedInterestRates {`;
    queryString +=
    `dpools {
      id
      address
      stablecoin
    }`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString +=
      `t${i}: dpools(
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        id
        address
        oneYearInterestRate
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
          borderColor: "rgba(" + (this.COLORS[parseInt(i) % this.COLORS.length]) + ", 0.5)",
          fill: false
        }
        this.data.push(dataobj);
      }

      for (let i in result) {
        if (i !== "dpools") {

          // initialize the data array
          for (let i in this.data) {
            if(this.data[i].label) {
              this.data[i].data.push(0);
            }
          }

          // populate the data array
          for (let d in result[i]) {
            let pool = result[i][d];
            let entry = this.data.find(x => x.label === pool.id);
            let fixedInterestRate = parseFloat(pool.oneYearInterestRate);
            entry.data[parseInt(i.substring(1))] = fixedInterestRate * 100;
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
  dpools: {
    id: string;
    address: string;
    oneYearInterestRate: number;
  }[];
}

interface DataObject {
  label: string;
  data: Array<number>;
  borderColor: string;
  fill: any;
}
