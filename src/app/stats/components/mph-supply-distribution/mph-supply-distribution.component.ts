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
  FIRST_INDEX: number = 1605744000;
  PERIOD: number = this.constants.WEEK_IN_SEC;
  ADDRESSES: string[] = [
    this.constants.GOV_TREASURY.toLowerCase(),
    this.constants.DEV_WALLET.toLowerCase(),
    this.constants.MPH_MERKLE_DISTRIBUTOR.toLowerCase(),
    this.constants.UNISWAP_LP.toLowerCase(),
    this.constants.SUSHI_LP.toLowerCase(),
    this.constants.BANCOR_LP.toLowerCase(),
    this.constants.REWARDS.toLowerCase(),
  ];

  // data variables
  timeseriesdata: number[][] = [];
  timestamps: number[] = [];
  readable: string[] = [];
  blocks: number[] = [];
  govTreasury: number[] = [];
  devWallet: number[] = [];
  merkleDistributor: number[] = [];
  uniswap: number[] = [];
  sushiswap: number[] = [];
  bancor: number[] = [];
  rewards: number[] = [];
  users: number[] = [];
  other: number[] = [];


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
        backgroundColor: "rgba(107, 94, 174, 0.3)",
        borderColor: "rgba(107, 94, 174, 1)",
        hoverBackgroundColor: "rgba(107, 94, 174, 1)"
      },
      {
        data: this.devWallet,
        label: "Dev Wallet",
        backgroundColor: "rgba(114, 125, 245, 0.3)",
        borderColor: "rgba(114, 125, 245, 1)",
        hoverBackgroundColor: "rgba(114, 125, 245, 1)"
      },
      {
        data: this.merkleDistributor,
        label: "Merkle Distributor",
        backgroundColor: "rgba(230, 55, 87, 0.3)",
        borderColor: "rgba(230, 55, 87, 1)",
        hoverBackgroundColor: "rgba(230, 55, 87, 1)"
      },
      {
        data: this.sushiswap,
        label: "Sushiswap",
        backgroundColor: "rgba(3, 184, 255, 0.3)",
        borderColor: "rgba(3, 184, 255, 1)",
        hoverBackgroundColor: "rgba(3, 184, 255, 1)"
      },
      {
        data: this.uniswap,
        label: "Uniswap",
        backgroundColor: "rgba(255, 103, 155, 0.3)",
        borderColor: "rgba(255, 103, 155, 1)",
        hoverBackgroundColor: "rgba(255, 103, 155, 1)"
      },
      {
        data: this.bancor,
        label: "Bancor",
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderColor: "rgba(255, 255, 255, 1)",
        hoverBackgroundColor: "rgba(255, 255, 255, 1)"
      },
      {
        data: this.rewards,
        label: "Rewards",
        backgroundColor: "rgba(246, 195, 67, 0.3)",
        borderColor: "rgba(246, 195, 67, 1)",
        hoverBackgroundColor: "rgba(246, 195, 67, 1)"
      },
      {
        data: this.other,
        label: "Community",
        backgroundColor: "rgba(149, 170, 201, 0.3)",
        borderColor: "rgba(149, 170, 201, 1)",
        hoverBackgroundColor: "rgba(149, 170, 201, 1)"
      },
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

    // create the apollo client
    const client = new ApolloClient({
      uri: 'https://api.thegraph.com/subgraphs/name/0xszeth/mph-token',
      cache: new InMemoryCache(),
    });

    // generate query for total MPH supply
    let supplyQueryString = `query Supply {`;
    for (let i = 0; i < this.blocks.length; i++) {
      supplyQueryString +=
      `t${i}: mph(
        id: "0"
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        totalSupply
      }`;
    }
    supplyQueryString += `}`;
    const supplyQuery = gql`${supplyQueryString}`;

    // run the total MPH supply query
    client.query<QueryResult>({
      query: supplyQuery
    }).then(result =>
      this.handleSupplyData(result)
    );

    // then generate array of addresses as a string
    let ids = `[`;
      for (let address in this.ADDRESSES) {
        ids += `"${this.ADDRESSES[address]}",`
      }
    ids += `]`

    // generate query for address specific balances
    let addressQueryString = `query AddressDistribution {`;
    for (let i = 0; i < this.blocks.length; i++) {
      addressQueryString +=
      `t${i}: mphholders(
        where: {
          id_in: ${ids}
        }
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        address
        mphBalance
      }`;
    }
    addressQueryString += `}`;
    const addressQuery = gql`${addressQueryString}`;

    client.query<QueryResult>({
      query: addressQuery
    }).then(result =>
      this.handleAddressData(result)
    );

  }

  handleSupplyData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      let result = queryResult.data;

      // initialize the data array
      for (let i = 0; i < this.blocks.length; i++) {
        this.other.push(0);
      }

      // populate the data array
      for (let t in result) {
        let mph = result[t];
        if (mph !== null) {
          this.other[parseInt(t.substring(1))] = parseFloat(mph.totalSupply);
        }
      }
    }
  }

  handleAddressData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      let result = queryResult.data;

      // initialize the data arrays
      for (let i = 0; i < this.blocks.length; i++) {
          this.govTreasury.push(0);
          this.devWallet.push(0);
          this.merkleDistributor.push(0);
          this.uniswap.push(0);
          this.sushiswap.push(0);
          this.bancor.push(0);
          this.rewards.push(0);
      }

      // populate the data arrays
      for (let t in result) {
        for (let a in this.ADDRESSES) {
          let address = this.ADDRESSES[a];
          let holder = result[t].find(holder => holder.address === address);

          if (holder !== undefined) {
            if (address === this.constants.GOV_TREASURY.toLowerCase()) {
              this.govTreasury[parseInt(t.substring(1))] = parseFloat(holder.mphBalance);
            } else if (address === this.constants.DEV_WALLET.toLowerCase()) {
              this.devWallet[parseInt(t.substring(1))] = parseFloat(holder.mphBalance);
            } else if (address === this.constants.MPH_MERKLE_DISTRIBUTOR.toLowerCase()) {
              this.merkleDistributor[parseInt(t.substring(1))] = parseFloat(holder.mphBalance);
            } else if (address === this.constants.UNISWAP_LP.toLowerCase()) {
              this.uniswap[parseInt(t.substring(1))] = parseFloat(holder.mphBalance);
            } else if (address === this.constants.SUSHI_LP.toLowerCase()) {
              this.sushiswap[parseInt(t.substring(1))] = parseFloat(holder.mphBalance);
            } else if (address === this.constants.BANCOR_LP.toLowerCase()) {
              this.bancor[parseInt(t.substring(1))] = parseFloat(holder.mphBalance);
            } else if (address === this.constants.REWARDS.toLowerCase()) {
              this.rewards[parseInt(t.substring(1))] = parseFloat(holder.mphBalance);
            }

            this.other[parseInt(t.substring(1))] -= parseFloat(holder.mphBalance);
          }
        }
      }
    }
  }
}

interface QueryResult {
  mph: {
    totalSupply: number;
  };
  mphholders: {
    address: string;
    mphBalance: number;
  }[];
}
