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

  getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
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
    for (let i = this.blocks.length - 1; i >= 0; i--) { // go backwards
      queryString +=
      `t${i}: dpools(
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        address
        stablecoin
        totalHistoricalDeposit
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
      for (let i in result) { // for each timestamp result

        let added: string[] = [];

        // for each dpool in the result
        // some dpools may not exist at each timestamp
        for (let k in result[i]) {

          let dpoolsnapshot = result[i][k];
          added.push(dpoolsnapshot.address);
          let entry = this.data.find(x => x.label === dpoolsnapshot.address);
          let dataobj: DataObject;
          if (entry) { // if it exists in our data structure

            entry.data.unshift(parseInt(dpoolsnapshot.totalActiveDeposit));

          } else { // if it doesn't exist in data structure

            let arr: number[] = [];
            arr.push(parseInt(dpoolsnapshot.totalActiveDeposit));
            dataobj = {
              data: arr,
              dataUSD: [],
              label: dpoolsnapshot.address,
              backgroundColor: this.getRandomColor(),
              stablecoin: dpoolsnapshot.stablecoin
            }
            this.data.push(dataobj);

          }
        }

        // if a dpool doesn't exist at the specific timestamp
        // push TVL of 0 to the data structure to maintain symmetry
        let notAdded: string[] = [];
        let existing: string[] = [];
        for(let m in this.data) {
          existing.push(this.data[m].label)
        }
        for (let i = 0; i < existing.length; i++) {
          if(!added.includes(existing[i])) {
            notAdded.push(existing[i]);
          }
        }
        for (let i = 0; i < notAdded.length; i++) { //for each that wasn't added
          let entry = this.data.find(x => x.label === notAdded[i]);
          entry.data.unshift(0);
        }

      }

      // get USD data for each asset over time
      let days = (this.timeseries.getLatestUTCDate() - this.FIRST_INDEX + this.constants.DAY_IN_SEC) / this.constants.DAY_IN_SEC;
      for (let i in this.data) {
        if (this.data[i].label && this.data[i].label != "0xb1abaac351e06d40441cf2cd97f6f0098e6473f2") { // if it's not the weird chartjs thing

          // fetch historical token prices from coingecko API
          let apiResult: number[][] = [];
          let prices: number[] = [];
          apiResult = await this.helpers.getHistoricalTokenPriceUSD(this.data[i].stablecoin, `${days}`);

          // push historical TVL in USD to the DataObject
          for (let j in this.timestamps) {
            // find the historical price in the api result
            let found = apiResult.find(price => price[0] == this.timestamps[j] * 1000);
            if (found) { // if a historical price is found
              prices.push(found[1]);
              this.data[i].dataUSD.push(this.data[i].data[j] * found[1]);
            } else { // if no historical price is found
              prices.push(0);
              this.data[i].dataUSD.push(0);
            }
          }

        } else if (this.data[i].label == "0xb1abaac351e06d40441cf2cd97f6f0098e6473f2") {
          // crvHUSD
          this.data[i].dataUSD = this.data[i].data;
        }
      }

      // swap data and dataUSD in dataobject for chart display
      for (let i in this.data) {
        if(this.data[i].label) {
          let swap = this.data[i].dataUSD;
          this.data[i].data = this.data[i].dataUSD;
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
    address: string;
    stablecoin: string;
    totalActiveDeposit: number;
    totalHistoricalDeposit: number;
  }[];
}

interface DataObject {
  data: Array<number>;
  dataUSD: Array<number>;
  label: string;
  backgroundColor: any;
  stablecoin: string;
}
