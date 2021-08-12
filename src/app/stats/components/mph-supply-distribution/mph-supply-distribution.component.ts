import { Component, OnInit, NgZone } from '@angular/core';
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
    [this.constants.CHAIN_ID.MAINNET]: 1605744000,
    [this.constants.CHAIN_ID.RINKEBY]: 1623196800,
  };
  // @dev setting this to DAY_IN_SEC throws a CORS error on the subgraph
  PERIOD: number = this.constants.WEEK_IN_SEC;

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
    public timeseries: TimeSeriesService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.resetChart();
    this.drawChart(this.wallet.networkID);
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetChart();
        this.drawChart(networkID);
      });
    });
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
  }

  async drawChart(networkID: number) {
    // wait for data to load
    const loaded = await this.loadData(networkID);
    if (!loaded) return;

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
          },
        ],
        yAxes: [
          {
            stacked: true,
            gridLines: {
              display: true,
              color: '#242526',
            },
          },
        ],
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
        label: 'xMPH',
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

  async loadData(networkID: number): Promise<boolean> {
    // wait to fetch timeseries data
    this.timeseriesdata = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX[this.wallet.networkID],
      this.PERIOD
    );

    // populate timestamps, blocks, and readable arrays
    this.timestamps = this.timeseriesdata[0];
    this.blocks = this.timeseriesdata[1];

    // transform timestamps to readable format
    let readable: string[] = [];
    for (let i in this.timestamps) {
      readable.push(
        new Date(this.timestamps[i] * 1000).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      );
    }
    this.readable = readable;

    // bail if a chain change has occured
    if (networkID !== this.wallet.networkID) {
      return false;
    }

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
      this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[this.wallet.networkID],
      supplyQuery
    ).then((data: QueryResult) => this.handleSupplyData(data));

    // fetch list of addresses
    this.addresses = await this.getAddresses();

    // then generate array of addresses as a string
    let ids = `[`;
    for (let address in this.addresses) {
      ids += `"${this.addresses[address]}",`;
    }
    ids += `]`;

    // generate query for address specific balances
    let addressQueryString = `query AddressDistribution {`;
    for (let i = 0; i < this.blocks.length; i++) {
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
    request(
      this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[this.wallet.networkID],
      addressQuery
    ).then((data: QueryResult) => this.handleAddressData(data));

    return true;
  }

  handleSupplyData(data: QueryResult) {
    // initialize the data array
    for (let i = 0; i < this.blocks.length; i++) {
      this.other.push(0);
    }

    // populate the data array
    for (let t in data) {
      let mph = data[t];
      if (mph !== null) {
        this.other[parseInt(t.substring(1))] = parseFloat(mph.totalSupply);
      }
    }
  }

  handleAddressData(data: QueryResult) {
    // initialize the data arrays
    for (let i = 0; i < this.blocks.length; i++) {
      this.govTreasury.push(0);
      this.devWallet.push(0);
      this.merkleDistributor.push(0);
      this.rewards.push(0);
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
            address ===
            this.constants.GOV_TREASURY[this.wallet.networkID].toLowerCase()
          ) {
            this.govTreasury[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.DEV_WALLET[this.wallet.networkID].toLowerCase()
          ) {
            this.devWallet[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.MERKLE_DISTRIBUTOR[
              this.wallet.networkID
            ].toLowerCase()
          ) {
            this.merkleDistributor[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.XMPH_ADDRESS[this.wallet.networkID].toLowerCase()
          ) {
            this.rewards[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.UNISWAP_V2_LP[this.wallet.networkID].toLowerCase()
          ) {
            this.uniswapv2[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.UNISWAP_V3_LP[this.wallet.networkID].toLowerCase()
          ) {
            this.uniswapv3[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.SUSHISWAP_LP[this.wallet.networkID].toLowerCase()
          ) {
            this.sushiswap[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          } else if (
            address ===
            this.constants.BANCOR_LP[this.wallet.networkID].toLowerCase()
          ) {
            this.bancor[parseInt(t.substring(1))] = parseFloat(
              holder.mphBalance
            );
          }

          this.other[parseInt(t.substring(1))] -= parseFloat(holder.mphBalance);
        }
      }
    }
  }

  getAddresses(): string[] {
    let addresses: string[] = [];
    addresses.push(
      this.constants.GOV_TREASURY[this.wallet.networkID].toLowerCase()
    );
    addresses.push(
      this.constants.DEV_WALLET[this.wallet.networkID].toLowerCase()
    );
    addresses.push(
      this.constants.MERKLE_DISTRIBUTOR[this.wallet.networkID].toLowerCase()
    );
    addresses.push(
      this.constants.XMPH_ADDRESS[this.wallet.networkID].toLowerCase()
    );
    addresses.push(
      this.constants.UNISWAP_V2_LP[this.wallet.networkID].toLowerCase()
    );
    addresses.push(
      this.constants.UNISWAP_V3_LP[this.wallet.networkID].toLowerCase()
    );
    addresses.push(
      this.constants.SUSHISWAP_LP[this.wallet.networkID].toLowerCase()
    );
    addresses.push(
      this.constants.BANCOR_LP[this.wallet.networkID].toLowerCase()
    );
    return addresses;
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
