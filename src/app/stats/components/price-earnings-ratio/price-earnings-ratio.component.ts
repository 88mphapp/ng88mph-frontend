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
  selector: 'app-price-earnings-ratio',
  templateUrl: './price-earnings-ratio.component.html',
  styleUrls: ['./price-earnings-ratio.component.css'],
})
export class PriceEarningsRatioComponent implements OnInit {
  // constants
  FIRST_INDEX = {
    [this.constants.CHAIN_ID.MAINNET]: 1620259200,
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
  data: number[];
  priceData: number[];
  earningsData: number[];

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
    this.priceData = [];
    this.earningsData = [];
  }

  async drawChart(networkID: number) {
    // wait for data to load
    const loaded = await this.loadData(networkID);
    if (!loaded) return;

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
            ticks: {
              suggestedMin: 0,
            },
          },
        ],
      },
      hover: {
        mode: 'dataset',
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
    this.lineChartData = [
      {
        data: this.data,
        borderColor: 'rgba(44, 123, 229, 0.5)',
        hoverBorderColor: 'rgba(44, 123, 229, 0.5)',
        pointHoverBorderColor: 'rgba(44, 123, 229, 1)',
        pointHoverBackgroundColor: 'rgba(44, 123, 229, 1)',
        fill: false,
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

    await this.getPriceData();

    return true;
  }

  async getPriceData() {
    // query Coingecko API for historical MPH market cap data
    // @dev if days < 100 then coingecko api returns inaccurate timestamps
    let days =
      (this.timeseries.getLatestUTCDate() -
        this.FIRST_INDEX[this.wallet.networkID] +
        this.constants.DAY_IN_SEC) /
      this.constants.DAY_IN_SEC;
    if (days < 100) {
      days = 100;
    }
    let apiResult = await this.helpers.getHistoricalMPHMarketCap(`${days}`);

    // process the results into an array
    for (let t in this.timestamps) {
      let datapoint = apiResult.find(
        (marketCap) => marketCap[0] === this.timestamps[t] * 1e3
      );
      if (datapoint) {
        this.priceData[t] = datapoint[1];
      } else {
        this.priceData[t] = 0;
      }
    }
    this.getEarningsData();
  }

  getEarningsData() {
    // build the query string
    let queryString = `query ProtocolEarnings {`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: xMPH(
        id: "0",
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        currentUnlockEndTimestamp
        lastRewardTimestamp
        lastRewardAmount
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // then run the query
    request(
      this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[this.wallet.networkID],
      query
    ).then((data: QueryResult) => this.handleData(data));
  }

  async handleData(data: QueryResult) {
    for (let t in data) {
      const start = parseInt(data[t].lastRewardTimestamp);
      const end = parseInt(data[t].currentUnlockEndTimestamp);
      const amount = parseFloat(data[t].lastRewardAmount);
      const now = Date.now() / 1e3;

      // annualize earnings per year from earnings per second
      const earningsPerSecond = amount / (end - start);
      const earningsPerYear = earningsPerSecond * this.constants.YEAR_IN_SEC;

      // fetch mph price in USD
      // @dev if days < 100 then coingecko api returns inaccurate timestamps
      let days =
        (this.timeseries.getLatestUTCDate() -
          this.FIRST_INDEX[this.wallet.networkID] +
          this.constants.DAY_IN_SEC) /
        this.constants.DAY_IN_SEC;
      if (days < 100) {
        days = 100;
      }
      let mphPriceData = await this.helpers.getHistoricalTokenPriceUSD(
        this.constants.MPH_ADDRESS[this.wallet.networkID],
        `${days}`
      );

      // add the USD value of earnings per year to the data array
      if (isNaN(earningsPerYear) || now > end) {
        this.earningsData[parseInt(t.substring(1))] = 0;
      } else {
        const mphPriceUSD = mphPriceData.find(
          (key) => key[0] === this.timestamps[parseInt(t.substring(1))] * 1e3
        )[1];
        this.earningsData[parseInt(t.substring(1))] =
          earningsPerYear * mphPriceUSD;
      }
    }

    // calculate the data to be displayed
    for (let t in this.timestamps) {
      const price = this.priceData[t];
      const earnings = this.earningsData[t];
      const ratio = price / earnings;

      if (earnings === 0) {
        this.data[t] = 0;
      } else {
        this.data[t] = ratio;
      }
    }
  }
}

interface QueryResult {
  xMPH: {
    currentUnlockEndTimestamp: string;
    lastRewardTimestamp: string;
    lastRewardAmount: string;
  };
}
