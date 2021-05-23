import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import BigNumber from 'bignumber.js';
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app//helpers.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-mph-supply-distribution',
  templateUrl: './mph-supply-distribution.component.html',
  styleUrls: ['./mph-supply-distribution.component.css']
})
export class MphSupplyDistributionComponent implements OnInit {

  // constants
  FIRST_INDEX: number = 1606262400;
  PERIOD: number = this.constants.WEEK_IN_SEC;
  ADDRESSES: string[] = [
    this.constants.GOV_TREASURY,
    this.constants.DEV_WALLET,
    this.constants.MPH_MERKLE_DISTRIBUTOR,
    "0x307ba97323907ef811f3cc6b4c6ac8580aecb1bb"
  ];

  addr: string = "0x307ba97323907ef811f3cc6b4c6ac8580aecb1bb";

  // data variables
  timeseriesdata: number[][] = [];
  timestamps: number[] = [];
  readable: string[] = [];
  blocks: number[] = [];
  data: number[] = [];

  govTreasury: number[] = [];
  devWallet: number[] = [];
  merkleDistributor: number[] = [];
  test: number[] = [];


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
    this.barChartData = [
      {
      data: this.govTreasury,
      label: "Gov Treasury",
      backgroundColor: "rgba(221, 107, 229, 0.3)",
      borderColor: "rgba(221, 107, 229, 1)",
      hoverBackgroundColor: "rgba(221, 107, 229, 1)"
      },
      {
        data: this.devWallet,
        label: "Dev Wallet",
        backgroundColor: "rgba(3, 184, 255, 0.3)",
        borderColor: "rgba(3, 184, 255, 1)",
        hoverBackgroundColor: "rgba(3, 184, 255, 1)"
      },
      {
        data: this.merkleDistributor,
        label: "Merkle Distributor",
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderColor: "rgba(255, 255, 255, 1)",
        hoverBackgroundColor: "rgba(255, 255, 255, 1)"
      },
      {
        data: this.test,
        label: "TEST",
        backgroundColor: "rgba(205, 205, 205, 0.3)",
        borderColor: "rgba(205, 205, 205, 1)",
        hoverBackgroundColor: "rgba(205, 205, 205, 1)"
      }
    ];
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

    console.log(this.timestamps);
    console.log(this.blocks);
    console.log(this.readable);

    const client = new ApolloClient({
      uri: 'https://api.thegraph.com/subgraphs/name/0xszeth/eighty-eight-mph',
      cache: new InMemoryCache(),
    });

    // *******FOR DEMO PURPOSES********
    this.blocks = [11324170];

    // then generate the query
    let queryString = `query MPHSupplyDistribution {`;
    for (let i = 0; i < this.blocks.length; i++) {
      // for each address we need
      for (let a = 0; a < this.ADDRESSES.length; a++) {
        queryString +=
        `t${i}${a}: mphholders(
          where: {
            address: "${this.ADDRESSES[a]}"
          }
          block: {
            number: ${this.blocks[i]}
          }
        ) {
          address
          mphBalance
        }`;
      }
    }
    queryString += `}`;
    const query = gql`${queryString}`;

    client.query<QueryResult>({
      query: query
    }).then(result =>
      this.handleData(result)
    );

  }

  handleData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      let result = queryResult.data;
      console.log(result);

      for (let i = 0; i < this.blocks.length; i++) {
          this.govTreasury.push(0);
          this.devWallet.push(0);
          this.merkleDistributor.push(0);
          this.test.push(0);
      }

      for (let i in result) {
        if (result[i][0]) { // if the query returned a value
          let address = result[i][0].address;
          if (address === this.constants.GOV_TREASURY) {
            this.govTreasury[parseInt(i.substring(1, 2))] = parseFloat(result[i][0].mphBalance);
          } else if (address === this.constants.DEV_WALLET) {
            this.devWallet[parseInt(i.substring(1, 2))] = parseFloat(result[i][0].mphBalance);
          } else if (address === this.constants.MPH_MERKLE_DISTRIBUTOR) {
            this.merkleDistributor[parseInt(i.substring(1, 2))] = parseFloat(result[i][0].mphBalance);
          } else if (address === "0x307ba97323907ef811f3cc6b4c6ac8580aecb1bb") {
            this.test[parseInt(i.substring(1, 2))] = parseFloat(result[i][0].mphBalance);
          }
        }
      }
    }
  }
}

interface QueryResult {
  mphholders: {
    address: string;
    mphBalance: number;
  }[];
}
