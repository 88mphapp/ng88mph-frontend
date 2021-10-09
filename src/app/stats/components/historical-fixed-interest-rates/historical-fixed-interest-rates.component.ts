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
  selector: 'app-historical-fixed-interest-rates',
  templateUrl: './historical-fixed-interest-rates.component.html',
  styleUrls: ['./historical-fixed-interest-rates.component.css'],
})
export class HistoricalFixedInterestRatesComponent implements OnInit {
  // constants
  FIRST_INDEX = {
    [this.constants.CHAIN_ID.MAINNET]: 1630972800,
    [this.constants.CHAIN_ID.RINKEBY]: 1624406400,
    [this.constants.CHAIN_ID.POLYGON]: 1633392000,
    [this.constants.CHAIN_ID.AVALANCHE]: 1633392000,
  };
  PERIOD: number = this.constants.DAY_IN_SEC;
  PERIOD_NAME: string = 'daily';
  SELECTED_ASSET: string = 'all';
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
  allData: DataObject[];

  // chart variables
  public lineChartOptions;
  public lineChartLabels;
  public lineChartType;
  public lineChartLegend;
  public lineChartData;

  constructor(
    public helpers: HelpersService,
    public constants: ConstantsService,
    public contract: ContractService,
    public wallet: WalletService,
    public timeseries: TimeSeriesService,
    private zone: NgZone
  ) {}

  async ngOnInit() {
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

  async drawChart(networkID: number, loadData: boolean = true) {
    // wait for data to load
    if (loadData) {
      const loaded = await this.loadData(networkID);
      if (!loaded) return;
    }

    // then draw the chart
    this.lineChartOptions = {
      scaleShowVerticalLines: false,
      responsive: true,
      scales: {
        xAxes: [
          {
            gridLines: {
              display: false,
            },
          },
        ],
        yAxes: [
          {
            gridLines: {
              display: true,
              color: '#242526',
            },
          },
        ],
      },
      hover: {
        mode: 'dataset',
        intersect: false,
      },
      tooltips: {
        mode: 'nearest',
        intersect: false,
        displayColors: true,
      },
      elements: {
        point: {
          radius: 0,
          hoverRadius: 2,
          hitRadius: 4,
        },
        line: {
          tension: 0,
          borderWidth: 2,
          hoverBorderWidth: 2,
        },
      },
    };
    this.lineChartLabels = this.readable;
    this.lineChartType = 'line';
    this.lineChartLegend = false;
    this.lineChartData = this.data;
  }

  async loadData(networkID: number): Promise<boolean> {
    // wait to fetch timeseries data
    this.timeseriesdata = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX[this.wallet.networkID],
      this.PERIOD,
      this.wallet.networkID
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

    // bail if a chain change has occured
    if (networkID !== this.wallet.networkID) {
      return false;
    }

    // then generate the query
    let queryString = `query HistoricalFixedInterestRates {`;
    queryString += `dpools {
      address
      oneYearInterestRate
    }`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: dpools(
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        address
        oneYearInterestRate
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

  handleData(data: QueryResult) {
    let result = data;
    let dpools = result.dpools;

    // build empty data structure
    for (let i in dpools) {
      let dataobj: DataObject;
      dataobj = {
        label: dpools[i].address,
        data: [],
        borderColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 0.5)',
        hoverBorderColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        pointBorderColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 0.5)',
        pointBackgroundColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 0.5)',
        pointHoverBorderColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        pointHoverBackgroundColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        fill: false,
      };
      this.data.push(dataobj);
    }

    for (let i in result) {
      if (i !== 'dpools') {
        // initialize the data array
        for (let d in this.data) {
          if (this.data[d].label) {
            this.data[d].data[parseInt(i.substring(1))] = 0;
          }
        }

        // populate the data array
        for (let d in result[i]) {
          let pool = result[i][d];
          let entry = this.data.find((x) => x.label === pool.address);
          let fixedInterestRate = parseFloat(pool.oneYearInterestRate);
          entry.data[parseInt(i.substring(1))] = fixedInterestRate * 100;
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

    this.data.shift();

    this.allData = [];
    this.allData = this.data;
    this.allData.sort((a, b) => {
      return a.label > b.label ? 1 : a.label < b.label ? -1 : 0;
    });
    this.focusAsset();
  }

  changePeriod() {
    if (this.PERIOD_NAME === 'daily') {
      this.PERIOD = this.constants.DAY_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1630972800,
        [this.constants.CHAIN_ID.RINKEBY]: 1624406400,
        [this.constants.CHAIN_ID.RINKEBY]: 1633392000,
        [this.constants.CHAIN_ID.AVALANCHE]: 1633392000,
      };
    } else if (this.PERIOD_NAME === 'weekly') {
      this.PERIOD = this.constants.WEEK_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1630800000,
        [this.constants.CHAIN_ID.RINKEBY]: 1624147200,
        [this.constants.CHAIN_ID.RINKEBY]: 1633219200,
        [this.constants.CHAIN_ID.AVALANCHE]: 1633219200,
      };
    } else if (this.PERIOD_NAME === 'monthly') {
      this.PERIOD = this.constants.MONTH_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1630454400,
        [this.constants.CHAIN_ID.RINKEBY]: 1622505600,
        [this.constants.CHAIN_ID.RINKEBY]: 1633046400,
        [this.constants.CHAIN_ID.AVALANCHE]: 1633046400,
      };
    }
    this.resetChart();
    this.drawChart(this.wallet.networkID);
  }

  focusAsset() {
    this.data = [];
    if (this.SELECTED_ASSET === 'all') {
      this.data = this.allData;
    } else {
      const selectedObj = this.allData.find(
        (pool) => pool.label === this.SELECTED_ASSET
      );
      this.data.push(selectedObj);
    }
    this.drawChart(this.wallet.networkID, false);
  }
}

interface QueryResult {
  dpools: {
    address: string;
    oneYearInterestRate: number;
  }[];
}

interface DataObject {
  label: string;
  data: Array<number>;
  borderColor: string;
  hoverBorderColor: string;
  pointBorderColor: string;
  pointBackgroundColor: string;
  pointHoverBorderColor: string;
  pointHoverBackgroundColor: string;
  fill: boolean;
}
