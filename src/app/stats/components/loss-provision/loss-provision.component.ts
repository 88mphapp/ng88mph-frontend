import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
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
    [this.constants.CHAIN_ID.MAINNET]: 1630195200,
    [this.constants.CHAIN_ID.POLYGON]: 1633219200,
    [this.constants.CHAIN_ID.AVALANCHE]: 1633219200,
    [this.constants.CHAIN_ID.FANTOM]: 1633824000,
    [this.constants.CHAIN_ID.V2]: 1606003200,
  };
  PERIOD: number = this.constants.WEEK_IN_SEC;
  PERIOD_NAME: string = 'weekly';
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

  @Input() displaySetting: string;

  // aggregated
  everythingTimestamps: number[];
  everythingData: DataObject[];
  // ethereum
  ethereumTimestamps: number[];
  ethereumData: DataObject[];
  // polygon
  polygonTimestamps: number[];
  polygonData: DataObject[];
  // avalanche
  avalancheTimestamps: number[];
  avalancheData: DataObject[];
  // fantom
  fantomTimestamps: number[];
  fantomData: DataObject[];
  // fantom
  v2Timestamps: number[];
  v2Data: DataObject[];

  // chart data
  dates: string[];
  data: DataObject[];
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
    public contract: ContractService,
    public wallet: WalletService,
    public timeseries: TimeSeriesService
  ) {}

  ngOnInit(): void {
    this.resetChart();
    this.drawChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes.displaySetting.firstChange) {
      this.focusDataset(this.displaySetting);
    }
  }

  resetChart() {
    // aggregated
    this.everythingTimestamps = [];
    this.everythingData = [];
    // ethereum
    this.ethereumTimestamps = [];
    this.ethereumData = [];
    // polygon
    this.polygonTimestamps = [];
    this.polygonData = [];
    // avalanche
    this.avalancheTimestamps = [];
    this.avalancheData = [];
    // fantom
    this.fantomTimestamps = [];
    this.fantomData = [];
    // fantom
    this.v2Timestamps = [];
    this.v2Data = [];

    // chart data
    this.dates = [];
    this.data = [];
    this.loading = true;
  }

  async drawChart(loadData: boolean = true) {
    // wait for data to load
    if (loadData) {
      this.loadAll();
    }

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
              labelString: 'USD',
            },
            ticks: {
              min: 0,
              callback: (label, index, labels) => {
                const size = Math.abs(labels[labels.length - 2]);
                let x;
                if (size < 0.1) {
                  x = label.toFixed(2).toString();
                } else if (size < 1) {
                  x = label.toFixed(1).toString();
                } else if (size < 1e3) {
                  x = label.toFixed(0).toString();
                } else if (size < 1e6) {
                  if (
                    this.barChartOptions.scales.yAxes[0].scaleLabel
                      .labelString !== 'Thousands (USD)'
                  ) {
                    const newOptions = { ...this.barChartOptions };
                    newOptions.scales.yAxes[0].scaleLabel.labelString =
                      'Thousands (USD)';
                    this.barChartOptions = newOptions;
                  }
                  x = (label / 1e3).toFixed(0).toString();
                } else if (size < 1e9) {
                  if (
                    this.barChartOptions.scales.yAxes[0].scaleLabel
                      .labelString !== 'Millions (USD)'
                  ) {
                    const newOptions = { ...this.barChartOptions };
                    newOptions.scales.yAxes[0].scaleLabel.labelString =
                      'Millions (USD)';
                    this.barChartOptions = newOptions;
                  }
                  x = (label / 1e6).toFixed(0).toString();
                } else {
                  if (
                    this.barChartOptions.scales.yAxes[0].scaleLabel
                      .labelString !== 'Billions (USD)'
                  ) {
                    const newOptions = { ...this.barChartOptions };
                    newOptions.scales.yAxes[0].scaleLabel.labelString =
                      'Billions (USD)';
                    this.barChartOptions = newOptions;
                  }
                  x = (label / 1e9).toFixed(0).toString();
                }
                const y = '$' + x.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return y;
              },
            },
          },
        ],
      },
      tooltips: {
        callbacks: {
          label: function (tooltipItem, data) {
            const pool = data.datasets[tooltipItem.datasetIndex].label;
            const value = tooltipItem.yLabel.toFixed(2);
            const formattedValue =
              '$' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return pool + ': ' + formattedValue;
          },
        },
      },
    };
    this.barChartLabels = this.dates;
    this.barChartType = 'bar';
    this.barChartLegend = false;
    this.barChartData = this.data;
  }

  async loadAll() {
    await Promise.all([
      this.loadData(this.constants.CHAIN_ID.MAINNET),
      this.loadData(this.constants.CHAIN_ID.POLYGON),
      this.loadData(this.constants.CHAIN_ID.AVALANCHE),
      this.loadData(this.constants.CHAIN_ID.FANTOM),
      this.loadData(this.constants.CHAIN_ID.V2),
    ]).then(() => {
      this.padData(this.ethereumTimestamps, this.ethereumData);
      this.padData(this.polygonTimestamps, this.polygonData);
      this.padData(this.avalancheTimestamps, this.avalancheData);
      this.padData(this.fantomTimestamps, this.fantomData);
      this.padData(this.v2Timestamps, this.v2Data);
      this.focusDataset(this.displaySetting);
    });
  }

  async loadData(networkID: number) {
    // fetch timestamps and blocks
    const [timestamps, blocks] = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX[networkID],
      this.PERIOD,
      networkID
    );

    // add timestamp array to appropriate chain variables
    switch (networkID) {
      case this.constants.CHAIN_ID.MAINNET:
        this.ethereumTimestamps = timestamps;
        break;
      case this.constants.CHAIN_ID.POLYGON:
        this.polygonTimestamps = timestamps;
        break;
      case this.constants.CHAIN_ID.AVALANCHE:
        this.avalancheTimestamps = timestamps;
        break;
      case this.constants.CHAIN_ID.FANTOM:
        this.fantomTimestamps = timestamps;
        break;
      case this.constants.CHAIN_ID.V2:
        this.v2Timestamps = timestamps;
        break;
    }

    // change everything array to largest timestamp array
    if (timestamps.length > this.everythingTimestamps.length) {
      this.everythingTimestamps = timestamps;
    }

    let queryString = `query InterestExpense {`;
    queryString += `dpools {
      id
      address
      stablecoin
    }`;
    for (let i = 0; i < blocks.length; i++) {
      queryString += `t${i}: dpools(
        block: {
          number: ${blocks[i]}
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
    await request(
      this.constants.BACK_TO_THE_FUTURE_GRAPHQL_ENDPOINT[networkID],
      query
    )
      .then((data: QueryResult) =>
        this.handleData(data, networkID, blocks, timestamps)
      )
      .catch((error) => {
        console.error(error);
      });
  }

  async handleData(
    data: QueryResult,
    networkID: number,
    blocks: number[],
    timestamps: number[]
  ) {
    let dpools = data.dpools;
    let chainData: DataObject[] = [];

    // build empty data structure
    for (let i in dpools) {
      let poolInfo = this.contract.getPoolInfoFromAddress(
        dpools[i].address,
        networkID === this.constants.CHAIN_ID.V2
          ? this.constants.CHAIN_ID.MAINNET
          : networkID,
        networkID === this.constants.CHAIN_ID.V2 ? true : false
      );
      let dataobj: DataObject;
      dataobj = {
        label: poolInfo.name,
        address: dpools[i].address,
        networkID: networkID,
        data: new Array(Object.keys(data).length - 1).fill(0),
        dataUSD: new Array(Object.keys(data).length - 1).fill(0),
        dataLossProvision: new Array(Object.keys(data).length - 1).fill(0),
        backgroundColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 0.5)',
        hoverBackgroundColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        stablecoin: dpools[i].stablecoin,
      };
      chainData[i] = dataobj;
    }

    // populate loss provision data
    for (let i in data) {
      if (i !== 'dpools') {
        // populate loss provision data
        for (let p in data[i]) {
          let pool = data[i][p];
          let entry = chainData.find((x) => x.address === pool.address);

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
        this.FIRST_INDEX[networkID] +
        this.constants.DAY_IN_SEC) /
      this.constants.DAY_IN_SEC;
    if (days < 100) {
      days = 100;
    }

    await Promise.all(
      chainData.map(async (pool) => {
        if (pool.label) {
          let apiResult: number[][] = [];
          const tvl = pool.dataLossProvision.find((x) => x > 0);
          if (tvl) {
            apiResult = await this.helpers.getHistoricalTokenPriceUSD(
              pool.stablecoin,
              `${days}`,
              blocks,
              timestamps,
              networkID === this.constants.CHAIN_ID.V2
                ? this.constants.CHAIN_ID.MAINNET
                : networkID,
              networkID === this.constants.CHAIN_ID.V2 ? false : true
            );
          }
          for (let t in timestamps) {
            const found = apiResult.find(
              (price) => price[0] === timestamps[t] * 1000
            );
            found ? (pool.dataUSD[t] = found[1]) : (pool.dataUSD[t] = 0);

            pool.data[t] = pool.dataLossProvision[t] * pool.dataUSD[t];
          }
        }
      })
    ).then(() => {
      chainData.sort((a, b) => {
        return a.label > b.label ? 1 : a.label < b.label ? -1 : 0;
      });

      // add chainData to appropriate chain variable
      switch (networkID) {
        case this.constants.CHAIN_ID.MAINNET:
          this.ethereumData = chainData;
          break;
        case this.constants.CHAIN_ID.POLYGON:
          this.polygonData = chainData;
          break;
        case this.constants.CHAIN_ID.AVALANCHE:
          this.avalancheData = chainData;
          break;
        case this.constants.CHAIN_ID.FANTOM:
          this.fantomData = chainData;
          break;
        case this.constants.CHAIN_ID.V2:
          this.v2Data = chainData;
          break;
      }
    });
  }

  getReadableTimestamps(timestamps: number[]): string[] {
    let readable: string[] = [];
    for (let i in timestamps) {
      readable.push(
        new Date(timestamps[i] * 1000).toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'short',
          day: 'numeric',
        })
      );
    }
    return readable;
  }

  changePeriod(name: string) {
    this.PERIOD_NAME = name;
    if (this.PERIOD_NAME === 'daily') {
      this.PERIOD = this.constants.DAY_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1630368000,
        [this.constants.CHAIN_ID.POLYGON]: 1633392000,
        [this.constants.CHAIN_ID.AVALANCHE]: 1633651200,
        [this.constants.CHAIN_ID.FANTOM]: 1633996800,
        [this.constants.CHAIN_ID.V2]: 1606176000,
      };
    } else if (this.PERIOD_NAME === 'weekly') {
      this.PERIOD = this.constants.WEEK_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1630195200,
        [this.constants.CHAIN_ID.POLYGON]: 1633219200,
        [this.constants.CHAIN_ID.AVALANCHE]: 1633219200,
        [this.constants.CHAIN_ID.FANTOM]: 1633824000,
        [this.constants.CHAIN_ID.V2]: 1606003200,
      };
    } else if (this.PERIOD_NAME === 'monthly') {
      this.PERIOD = this.constants.MONTH_IN_SEC;
      this.FIRST_INDEX = {
        [this.constants.CHAIN_ID.MAINNET]: 1627776000,
        [this.constants.CHAIN_ID.POLYGON]: 1633046400,
        [this.constants.CHAIN_ID.AVALANCHE]: 1633046400,
        [this.constants.CHAIN_ID.FANTOM]: 1633046400,
        [this.constants.CHAIN_ID.V2]: 1604188800,
      };
    }
    this.resetChart();
    this.drawChart();
  }

  focusAsset() {
    let data: DataObject[];
    switch (this.displaySetting) {
      case 'all':
        data = this.everythingData;
        break;
      case 'ethereum':
        data = this.ethereumData;
        break;
      case 'polygon':
        data = this.polygonData;
        break;
      case 'avalanche':
        data = this.avalancheData;
        break;
      case 'fantom':
        data = this.fantomData;
        break;
      case 'v2':
        data = this.v2Data;
        break;
    }

    this.data = [];
    if (this.SELECTED_ASSET === 'all') {
      this.data = data;
    } else {
      const selectedObj = data.find(
        (pool) => pool.address === this.SELECTED_ASSET
      );
      this.data.push(selectedObj);
    }
    this.drawChart(false);
  }

  focusDataset(displaySetting: string) {
    switch (displaySetting) {
      case 'all':
        this.data = this.everythingData;
        this.dates = this.getReadableTimestamps(this.everythingTimestamps);
        break;
      case 'ethereum':
        this.data = this.ethereumData;
        this.dates = this.getReadableTimestamps(this.ethereumTimestamps);
        break;
      case 'polygon':
        this.data = this.polygonData;
        this.dates = this.getReadableTimestamps(this.polygonTimestamps);
        break;
      case 'avalanche':
        this.data = this.avalancheData;
        this.dates = this.getReadableTimestamps(this.avalancheTimestamps);
        break;
      case 'fantom':
        this.data = this.fantomData;
        this.dates = this.getReadableTimestamps(this.fantomTimestamps);
        break;
      case 'v2':
        this.data = this.v2Data;
        this.dates = this.getReadableTimestamps(this.v2Timestamps);
        break;
    }
    this.loading = false;
    this.drawChart(false);
  }

  padData(timestamps: number[], data: DataObject[]) {
    let array = JSON.parse(JSON.stringify(data));
    let padArray = [];

    const delta = this.everythingTimestamps.length - timestamps.length;
    for (let i = 0; i < delta; i++) {
      padArray.push(0);
    }

    for (let pool in array) {
      let poolData = padArray.concat(array[pool].data);
      array[pool].data = poolData;
    }

    this.everythingData = this.everythingData.concat(array);
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
  address: string;
  networkID: number;
  data: number[];
  dataUSD: number[];
  dataLossProvision: number[];
  backgroundColor: string;
  hoverBackgroundColor: string;
  stablecoin: string;
}
