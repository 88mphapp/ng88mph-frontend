import { Component, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app//helpers.service';
import { WalletService } from 'src/app//wallet.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-mph-supply-distribution',
  templateUrl: './mph-supply-distribution.component.html',
  styleUrls: ['./mph-supply-distribution.component.css'],
})
export class MphSupplyDistributionComponent implements OnInit {
  // constants
  FIRST_INDEX = {
    [this.constants.CHAIN_ID.MAINNET]: 1605834000,
  };
  PERIOD: number = this.constants.WEEK_IN_SEC;
  PERIOD_NAME: string = 'weekly';

  // data variables
  addresses: string[];
  timeseriesdata: number[][];
  timestamps: number[];
  readable: string[];
  blocks: number[];
  govTreasury: number[];
  devWallet: number[];
  merkleDistributor: number[];
  rewards: number[];
  uniswapv2: number[];
  uniswapv3: number[];
  sushiswap: number[];
  bancor: number[];
  other: number[];
  loading: boolean;

  // chart variables
  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(
    public helpers: HelpersService,
    public constants: ConstantsService,
    public wallet: WalletService,
    public timeseries: TimeSeriesService
  ) {}

  ngOnInit(): void {
    this.resetChart();
    this.drawChart();
  }

  resetChart() {
    this.addresses = [];
    this.timeseriesdata = [];
    this.timestamps = [];
    this.readable = [];
    this.blocks = [];
    this.govTreasury = [];
    this.devWallet = [];
    this.merkleDistributor = [];
    this.rewards = [];
    this.uniswapv2 = [];
    this.uniswapv3 = [];
    this.sushiswap = [];
    this.bancor = [];
    this.other = [];
    this.loading = true;
  }

  async drawChart() {
    // wait for data to load
    await this.loadData(this.constants.CHAIN_ID.MAINNET);

    // then draw the chart
    this.barChartOptions = {
      scaleShowVerticalLines: false,
      responsive: true,
      scales: {
        xAxes: [
          {
            stacked: true,
            gridLines: {
              display: false,
            },
            ticks: {
              autoSkip: true,
              autoSkipPadding: 5,
            },
          },
        ],
        yAxes: [
          {
            stacked: true,
            gridLines: {
              display: true,
              color: '#242526',
            },
            scaleLabel: {
              display: true,
              labelString: 'Thousands (MPH)',
            },
            ticks: {
              suggestedMin: 0,
              callback: function (label, index, labels) {
                const x = label / 1e3;
                const y = x
                  .toFixed(0)
                  .toString()
                  .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return y;
              },
            },
          },
        ],
      },
      tooltips: {
        callbacks: {
          label: function (tooltipItem, data) {
            const index = tooltipItem.datasetIndex;
            const holder = data.datasets[index].label;
            const item = tooltipItem.yLabel.toFixed(2);
            const formattedItem = item
              .toString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return holder + ': ' + formattedItem;
          },
        },
      },
    };
    this.barChartLabels = this.readable;
    this.barChartType = 'bar';
    this.barChartLegend = false;
    this.barChartData = [
      {
        data: this.govTreasury,
        label: 'Gov Treasury',
        backgroundColor: 'rgba(107, 94, 174, 0.3)',
        borderColor: 'rgba(107, 94, 174, 1)',
        hoverBackgroundColor: 'rgba(107, 94, 174, 1)',
      },
      {
        data: this.devWallet,
        label: 'Dev Wallet',
        backgroundColor: 'rgba(114, 125, 245, 0.3)',
        borderColor: 'rgba(114, 125, 245, 1)',
        hoverBackgroundColor: 'rgba(114, 125, 245, 1)',
      },
      {
        data: this.merkleDistributor,
        label: 'Merkle Distributor',
        backgroundColor: 'rgba(230, 55, 87, 0.3)',
        borderColor: 'rgba(230, 55, 87, 1)',
        hoverBackgroundColor: 'rgba(230, 55, 87, 1)',
      },
      {
        data: this.rewards,
        label: 'Staked MPH',
        backgroundColor: 'rgba(246, 195, 67, 0.3)',
        borderColor: 'rgba(246, 195, 67, 1)',
        hoverBackgroundColor: 'rgba(246, 195, 67, 1)',
      },
      {
        data: this.uniswapv2,
        label: 'Uniswap V2',
        backgroundColor: 'rgba(255, 103, 155, 0.3)',
        borderColor: 'rgba(255, 103, 155, 1)',
        hoverBackgroundColor: 'rgba(255, 103, 155, 1)',
      },
      {
        data: this.uniswapv3,
        label: 'Uniswap V3',
        backgroundColor: 'rgba(255, 103, 155, 0.3)',
        borderColor: 'rgba(255, 103, 155, 1)',
        hoverBackgroundColor: 'rgba(255, 103, 155, 1)',
      },
      {
        data: this.sushiswap,
        label: 'Sushiswap',
        backgroundColor: 'rgba(3, 184, 255, 0.3)',
        borderColor: 'rgba(3, 184, 255, 1)',
        hoverBackgroundColor: 'rgba(3, 184, 255, 1)',
      },
      {
        data: this.bancor,
        label: 'Bancor',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderColor: 'rgba(255, 255, 255, 1)',
        hoverBackgroundColor: 'rgba(255, 255, 255, 1)',
      },
      {
        data: this.other,
        label: 'Community',
        backgroundColor: 'rgba(149, 170, 201, 0.3)',
        borderColor: 'rgba(149, 170, 201, 1)',
        hoverBackgroundColor: 'rgba(149, 170, 201, 1)',
      },
    ];
  }

  async loadData(networkID: number) {
    // wait to fetch timeseries data
    this.timeseriesdata = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX[networkID],
      this.PERIOD,
      networkID
    );

    // populate timestamps, blocks, and readable arrays
    this.timestamps = this.timeseriesdata[0];
    this.blocks = this.timeseriesdata[1];

    // transform timestamps to readable format
    let readable: string[] = [];
    for (let i in this.timestamps) {
      readable.push(
        new Date(this.timestamps[i] * 1000).toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'short',
          day: 'numeric',
        })
      );
    }
    this.readable = readable;

    // generate the query for total MPH supply
    let supplyQueryString = `query TotalSupply {`;
    for (let i = 0; i < this.blocks.length; i++) {
      supplyQueryString += `t${i}: mph(
        id: "0"
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        totalSupply
      }`;
    }
    supplyQueryString += `}`;
    const supplyQuery = gql`
      ${supplyQueryString}
    `;

    // then run the query
    request(
      this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[networkID],
      supplyQuery
    ).then((data: QueryResult) => this.handleSupplyData(data));

    // fetch list of addresses
    this.addresses = await this.getAddresses(networkID);

    // then generate array of addresses as a string
    let ids = `[`;
    for (let address in this.addresses) {
      ids += `"${this.addresses[address]}",`;
    }
    ids += `]`;

    let count: number = 0;
    while (count < this.timestamps.length) {
      let limit = this.timestamps.length - count;
      if (limit > 150) {
        limit = 150;
      }
      // generate query for address specific balances
      let addressQueryString = `query AddressDistribution {`;
      for (let i = count; i < count + limit; i++) {
        addressQueryString += `t${i}: mphholders(
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
      const addressQuery = gql`
        ${addressQueryString}
      `;

      // then run the query
      let result = await request(
        this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[networkID],
        addressQuery
      ).then((data: QueryResult) => {
        return data;
      });
      this.handleAddressData(result, limit, networkID);
      count += limit;
    }
  }

  handleSupplyData(data: QueryResult) {
    for (let t in data) {
      let mph = data[t];
      if (mph !== null) {
        if (this.other[parseInt(t.substring(1))] === undefined) {
          this.other[parseInt(t.substring(1))] = 0;
        }
        this.other[parseInt(t.substring(1))] += parseFloat(mph.totalSupply);
      }
    }
  }

  handleAddressData(data: QueryResult, limit: number, networkID: number) {
    for (let i = 0; i < limit; i++) {
      this.govTreasury.push(0);
      this.devWallet.push(0);
      this.merkleDistributor.push(0);
      this.uniswapv2.push(0);
      this.uniswapv3.push(0);
      this.sushiswap.push(0);
      this.bancor.push(0);
    }

    // populate the data arrays
    for (let t in data) {
      for (let a in this.addresses) {
        let address = this.addresses[a];
        let holder = data[t].find((holder) => holder.address === address);

        if (holder !== undefined) {
          if (
            address === this.constants.GOV_TREASURY[networkID].toLowerCase()
          ) {
            this.govTreasury[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address === this.constants.DEV_WALLET[networkID].toLowerCase()
          ) {
            this.devWallet[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.MERKLE_DISTRIBUTOR[networkID].toLowerCase()
          ) {
            this.merkleDistributor[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address === this.constants.XMPH_ADDRESS[networkID].toLowerCase() ||
            address === this.constants.V2_REWARDS[networkID].toLowerCase()
          ) {
            if (this.rewards[parseInt(t.substring(1))] === undefined) {
              this.rewards[parseInt(t.substring(1))] = 0;
            }
            this.rewards[parseInt(t.substring(1))] += parseFloat(
              holder.mphBalance
            );
          } else if (
            address === this.constants.UNISWAP_V2_LP[networkID].toLowerCase()
          ) {
            this.uniswapv2[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address === this.constants.UNISWAP_V3_LP[networkID].toLowerCase()
          ) {
            this.uniswapv3[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.SUSHISWAP_LP[
              this.constants.CHAIN_ID.MAINNET
            ].toLowerCase()
          ) {
            this.sushiswap[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address === this.constants.BANCOR_LP[networkID].toLowerCase()
          ) {
            this.bancor[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          }

          if (this.other[parseInt(t.substring(1))] === undefined) {
            this.other[parseInt(t.substring(1))] = 0;
          }
          this.other[parseInt(t.substring(1))] -= parseFloat(holder.mphBalance);
        }
      }
    }

    this.loading = false;
  }

  getAddresses(networkID: number): string[] {
    let addresses: string[] = [];
    addresses.push(this.constants.GOV_TREASURY[networkID].toLowerCase());
    addresses.push(this.constants.DEV_WALLET[networkID].toLowerCase());
    addresses.push(this.constants.MERKLE_DISTRIBUTOR[networkID].toLowerCase());
    addresses.push(this.constants.XMPH_ADDRESS[networkID].toLowerCase());
    addresses.push(this.constants.V2_REWARDS[networkID].toLowerCase());
    addresses.push(this.constants.UNISWAP_V2_LP[networkID].toLowerCase());
    addresses.push(this.constants.UNISWAP_V3_LP[networkID].toLowerCase());
    addresses.push(this.constants.SUSHISWAP_LP[networkID].toLowerCase());
    addresses.push(this.constants.BANCOR_LP[networkID].toLowerCase());
    return addresses;
  }

  changePeriod(name: string) {
    this.PERIOD_NAME = name;
    if (this.PERIOD_NAME === 'daily') {
      this.PERIOD = this.constants.DAY_IN_SEC;
    } else if (this.PERIOD_NAME === 'weekly') {
      this.PERIOD = this.constants.WEEK_IN_SEC;
    } else if (this.PERIOD_NAME === 'monthly') {
      this.PERIOD = this.constants.MONTH_IN_SEC;
    }

    this.resetChart();
    this.drawChart();
  }
}

interface QueryResult {
  mph: {
    totalSupply: number;
  };
  mphholders: {
    address: string;
    mphBalance;
    string;
  }[];
}
