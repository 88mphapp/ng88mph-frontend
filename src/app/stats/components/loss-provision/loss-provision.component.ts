import { Component, OnInit, NgZone } from '@angular/core';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app//helpers.service';
import { WalletService } from 'src/app//wallet.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-loss-provision',
  templateUrl: './loss-provision.component.html',
  styleUrls: ['./loss-provision.component.css'],
})
export class LossProvisionComponent implements OnInit {
  // constants
  FIRST_INDEX = {
    [this.constants.CHAIN_ID.MAINNET]: 1624406400,
    [this.constants.CHAIN_ID.RINKEBY]: 1624406400,
  };
  PERIOD: number = this.constants.DAY_IN_SEC;
  COLORS: string[] = [
    '44, 123, 229',
    '255, 103, 155',
    '107, 94, 174',
    '114, 124, 245',
    '230, 55, 87',
    '253, 126, 20',
    '246, 195, 67',
    '0, 217, 126',
    '2, 168, 181',
    '57, 175, 209',
  ];

  // data variables
  timeseriesdata: number[][];
  timestamps: number[];
  readable: string[];
  blocks: number[];
  data: DataObject[];

  // chart variables
  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(
    public helpers: HelpersService,
    public constants: ConstantsService,
    public contract: ContractService,
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
    this.timeseriesdata = [];
    this.timestamps = [];
    this.readable = [];
    this.blocks = [];
    this.data = [];
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
    this.barChartData = this.data;
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

    let queryString = `query InterestExpense {`;
    queryString += `dpools {
      id
      address
      stablecoin
    }`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: dpools(
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        id
        address
        surplus
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // then run the query
    request(
      this.constants.BACK_TO_THE_FUTURE_GRAPHQL_ENDPOINT[this.wallet.networkID],
      query
    ).then((data: QueryResult) => this.handleData(data));

    return true;
  }

  async handleData(data: QueryResult) {
    let dpools = data.dpools;

    // build empty data structure
    for (let i in dpools) {
      let dataobj: DataObject;
      dataobj = {
        label: dpools[i].id,
        data: [],
        dataUSD: [],
        dataLossProvision: [],
        backgroundColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 0.5)',
        hoverBackgroundColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        stablecoin: dpools[i].stablecoin,
      };
      this.data[i] = dataobj;
    }

    // populate loss provision data
    for (let i in data) {
      if (i !== 'dpools') {
        // initialize dpool data arrays
        for (let x in this.data) {
          if (this.data[x].label) {
            this.data[x].dataLossProvision[parseInt(i.substring(1))] = 0;
          }
        }

        // populate loss provision data
        for (let p in data[i]) {
          let pool = data[i][p];
          let entry = this.data.find((x) => x.label === pool.id);

          let surplus = parseFloat(pool.surplus);
          if (surplus < 0) {
            entry.dataLossProvision[parseInt(i.substring(1))] -= surplus;
          }
        }
      }
    }

    // populate asset USD value data
    // @dev if days < 100 then coingecko api returns inaccurate timestamps
    let days =
      (this.timeseries.getLatestUTCDate() -
        this.FIRST_INDEX[this.wallet.networkID] +
        this.constants.DAY_IN_SEC) /
      this.constants.DAY_IN_SEC;
    if (days < 100) {
      days = 100;
    }
    for (let i in this.data) {
      if (
        this.data[i].label &&
        this.data[i].label != '0xb1abaac351e06d40441cf2cd97f6f0098e6473f2'
      ) {
        // fetch historical token prices from coingecko API
        let apiResult: number[][] = [];
        let prices: number[] = [];
        apiResult = await this.helpers.getHistoricalTokenPriceUSD(
          this.data[i].stablecoin,
          `${days}`
        );

        // push historical USD data to the DataObject
        for (let j in this.timestamps) {
          // find the historical price in the api result
          let found = apiResult.find(
            (price) => price[0] == this.timestamps[j] * 1000
          );
          if (found) {
            // if a historical price is found
            this.data[i].dataUSD[j] = found[1];
          } else {
            // if no historical price is found
            this.data[i].dataUSD[j] = 0;
          }
        }
      } else if (
        this.data[i].label == '0xb1abaac351e06d40441cf2cd97f6f0098e6473f2'
      ) {
        // crvHUSD
        for (let j in this.timestamps) {
          this.data[i].dataUSD.push(1);
        }
      }
    }

    // calculate the data to display
    for (let i in this.data) {
      if (this.data[i].label) {
        for (let j = 0; j < this.data[i].dataUSD.length; j++) {
          let loss = this.data[i].dataLossProvision[j];
          let usd = this.data[i].dataUSD[j];
          this.data[i].data[j] = loss * usd;
        }
      }
    }

    // get human readable labels
    for (let i in this.data) {
      if (this.data[i].label) {
        let poolInfo = this.contract.getPoolInfoFromAddress(this.data[i].label);
        let name = poolInfo.name;
        this.data[i].label = name;
      }
    }
  }
}

interface QueryResult {
  dpools: {
    id: string;
    address: string;
    stablecoin: string;
    surplus: string;
  }[];
}

interface DataObject {
  label: string;
  data: number[];
  dataUSD: number[];
  dataLossProvision: number[];
  backgroundColor: string;
  hoverBackgroundColor: string;
  stablecoin: string;
}
