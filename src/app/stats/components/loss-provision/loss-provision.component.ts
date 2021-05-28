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
  selector: 'app-loss-provision',
  templateUrl: './loss-provision.component.html',
  styleUrls: ['./loss-provision.component.css']
})
export class LossProvisionComponent implements OnInit {

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
    let queryString = `query InterestExpense {`;
    queryString +=
    `dpools {
      id
      address
      stablecoin
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
          fundingID: "0"
        }
      ) {
        pool {
          id
        }
        amount
        interestEarned
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
          dataUSD: [],
          dataLossProvision: [],
          backgroundColor: "rgba(" + (this.COLORS[parseInt(i) % this.COLORS.length]) + ", 0.5)",
          hoverBackgroundColor: "rgba(" + (this.COLORS[parseInt(i) % this.COLORS.length]) + ", 1)",
          stablecoin: dpools[i].stablecoin
        }
        this.data.push(dataobj);
      }

      // populate loss provision data
      for (let i in result) {
        if (i !== "dpools") {

          // initialize dpool data arrays
          for (let i in this.data) {
            if(this.data[i].label) {
              this.data[i].dataLossProvision.push(0);
            }
          }

          // populate loss provision data
          for (let d in result[i]) {
            let deposit = result[i][d];
            let entry = this.data.find(x => x.label === deposit.pool.id);
            let totalOwed = parseFloat(deposit.interestEarned);
            entry.dataLossProvision[parseInt(i.substring(1))] += totalOwed;
          }
        }
      }

      // populate asset USD value data arrays
      let days = (this.timeseries.getLatestUTCDate() - this.FIRST_INDEX + this.constants.DAY_IN_SEC) / this.constants.DAY_IN_SEC;
      for (let i in this.data) {
        if (this.data[i].label && this.data[i].label != "0xb1abaac351e06d40441cf2cd97f6f0098e6473f2") { // if it's not the weird chartjs thing

          // fetch historical token prices from coingecko API
          let apiResult: number[][] = [];
          let prices: number[] = [];
          apiResult = await this.helpers.getHistoricalTokenPriceUSD(this.data[i].stablecoin, `${days}`);

          // push historical USD data to the DataObject
          for (let j in this.timestamps) {
            // find the historical price in the api result
            let found = apiResult.find(price => price[0] == this.timestamps[j] * 1000);
            if (found) { // if a historical price is found
              this.data[i].dataUSD.push(found[1]);
            } else { // if no historical price is found
              this.data[i].dataUSD.push(0);
            }
          }

        } else if (this.data[i].label == "0xb1abaac351e06d40441cf2cd97f6f0098e6473f2") {
          // crvHUSD
          for (let j in this.timestamps) {
            this.data[i].dataUSD.push(1);
          }
        }
      }

      // calculate the data to display
      for (let i in this.data) {
        if(this.data[i].label) {
          for (let j = 0; j < this.data[i].dataUSD.length; j++) {
            let loss = this.data[i].dataLossProvision[j];
            let usd = this.data[i].dataUSD[j];
            this.data[i].data.push(loss*usd);
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
  }[];
  dpools: {
    id: string;
    address: string;
    stablecoin: string;
  }[];
}

interface DataObject {
  label: string;
  data: Array<number>;
  dataUSD: Array<number>;
  dataLossProvision: Array<number>;
  backgroundColor: string;
  hoverBackgroundColor: string;
  stablecoin: string;
}
