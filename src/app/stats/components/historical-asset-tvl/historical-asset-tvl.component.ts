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
  selector: 'app-historical-asset-tvl',
  templateUrl: './historical-asset-tvl.component.html',
  styleUrls: ['./historical-asset-tvl.component.css']
})

export class HistoricalAssetTvlComponent implements OnInit {

  // constants
  FIRST_INDEX: number = 1606262400;
  PERIOD: number = this.constants.DAY_IN_SEC;
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
    let queryString = `query HistoricalAssetTVL {`;
    queryString +=
    `dpools {
      address
      stablecoin
      totalActiveDeposit
    }`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString +=
      `t${i}: dpools(
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        address
        stablecoin
        totalActiveDeposit
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
      for (let pool in dpools) {
        let dataobj: DataObject;
        dataobj = {
          label: dpools[pool].address,
          data: [],
          dataTVL: [],
          dataUSD: [],
          backgroundColor: "rgba(" + (this.COLORS[parseInt(pool) % this.COLORS.length]) + ", 0.5)",
          hoverBackgroundColor: "rgba(" + (this.COLORS[parseInt(pool) % this.COLORS.length]) + ", 1)",
          stablecoin: dpools[pool].stablecoin
        }
        this.data.push(dataobj);
      }

      for (let t in result) { // for each timestamp result
        if (t !== "dpools") {

          // initialize the dataTVL array
          for (let pool in this.data) {
            if(this.data[pool].label) {
              this.data[pool].dataTVL.push(0);
            }
          }

          // populate the dataTVL array
          for (let pool in result[t]) {
            let dpool = result[t][pool];
            let entry = this.data.find(pool => pool.label === dpool.address);
            entry.dataTVL[parseInt(t.substring(1))] = parseFloat(dpool.totalActiveDeposit);
          }
        }
      }

      // populate the dataUSD array
      let days = (this.timeseries.getLatestUTCDate() - this.FIRST_INDEX + this.constants.DAY_IN_SEC) / this.constants.DAY_IN_SEC;
      for (let pool in this.data) {
        if (this.data[pool].label && this.data[pool].label !== "0xb1abaac351e06d40441cf2cd97f6f0098e6473f2") {

          // fetch historical token prices from coingecko API
          let apiResult: number[][] = [];
          apiResult = await this.helpers.getHistoricalTokenPriceUSD(this.data[pool].stablecoin, `${days}`);

          for (let t in this.timestamps) {
            // find the historical price in the api result
            let found = apiResult.find(price => price[0] === this.timestamps[t] * 1000);
            if (found) { // if a historical price is found
              this.data[pool].dataUSD.push(found[1]);
            } else {
              this.data[pool].dataUSD.push(0);
            }
          }
        } else if (this.data[pool].label === "0xb1abaac351e06d40441cf2cd97f6f0098e6473f2") {
          for (let t in this.timestamps) {
            this.data[pool].dataUSD.push(1);
          }
        }
      }

      // populate the data array to be charted
      for (let pool in this.data) {
        if (this.data[pool].label) {
          let dpool = this.data[pool];
          for (let t in this.timestamps) {
            dpool.data.push(dpool.dataTVL[t] * dpool.dataUSD[t]);
          }
        }
      }

      // get human readable labels
      for (let pool in this.data) {
        if(this.data[pool].label) {
          let poolInfo = this.contract.getPoolInfoFromAddress(this.data[pool].label);
          let name = poolInfo.name;
          this.data[pool].label = name;
        }
      }

    }
  }
}

interface QueryResult {
  dpools: {
    address: string;
    stablecoin: string;
    totalActiveDeposit: number;
  }[];
}

interface DataObject {
  label: string;
  data: Array<number>;
  dataTVL: Array<number>;
  dataUSD: Array<number>;
  backgroundColor: string;
  hoverBackgroundColor: string;
  stablecoin: string;
}
