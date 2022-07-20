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
  selector: 'app-net-interest-margin',
  templateUrl: './net-interest-margin.component.html',
  styleUrls: ['./net-interest-margin.component.css'],
})
export class NetInterestMarginComponent implements OnInit {
  // constants
  FIRST_INDEX = {
    [this.constants.CHAIN_ID.MAINNET]: 1630454400,
    [this.constants.CHAIN_ID.POLYGON]: 1633564800,
    [this.constants.CHAIN_ID.AVALANCHE]: 1633737600,
    [this.constants.CHAIN_ID.FANTOM]: 1634083200,
    [this.constants.CHAIN_ID.V2]: 1606176000,
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
  // v2
  v2Timestamps: number[];
  v2Data: DataObject[];

  // chart data
  dates: string[];
  data: DataObject[];
  loading: boolean;

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
    this.lineChartOptions = {
      scaleShowVerticalLines: false,
      responsive: true,
      scales: {
        xAxes: [
          {
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
            gridLines: {
              display: true,
              color: '#242526',
            },
            scaleLabel: {
              display: true,
              labelString: 'Net Interest Margin (%)',
            },
            ticks: {
              suggestedMin: 0,
              callback: function (label, index, labels) {
                const size = Math.abs(labels[labels.length - 2]);
                if (size < 0.001) {
                  return label.toFixed(4);
                } else if (size < 0.01) {
                  return label.toFixed(3);
                } else if (size < 0.1) {
                  return label.toFixed(2);
                } else if (size < 1) {
                  return label.toFixed(1);
                } else {
                  return label.toFixed(0);
                }
              },
            },
          },
        ],
        y: {
          min: 0,
        },
      },
      hover: {
        mode: 'dataset',
        intersect: false,
      },
      tooltips: {
        mode: 'nearest',
        intersect: false,
        displayColors: true,
        callbacks: {
          label: function (tooltipItem, data) {
            const pool = data.datasets[tooltipItem.datasetIndex].label;
            const value = tooltipItem.yLabel.toFixed(4) + '%';
            return pool + ': ' + value;
          },
        },
      },
      elements: {
        point: {
          radius: 0,
          hoverRadius: 2,
          hitRadius: 4,
        },
        line: {
          tension: 0.4,
          borderWidth: 2,
          hoverBorderWidth: 2,
        },
      },
    };
    this.lineChartLabels = this.dates;
    this.lineChartType = 'line';
    this.lineChartLegend = false;
    this.lineChartData = this.data;
  }

  async loadAll() {
    await Promise.all([
      this.loadData(this.constants.CHAIN_ID.MAINNET),
      this.loadData(this.constants.CHAIN_ID.POLYGON),
      this.loadData(this.constants.CHAIN_ID.AVALANCHE),
      this.loadData(this.constants.CHAIN_ID.FANTOM),
      this.loadDataV2(),
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
    }

    // change everything array to largest timestamp array
    if (timestamps.length > this.everythingTimestamps.length) {
      this.everythingTimestamps = timestamps;
    }

    // generate the query
    let queryString = `query Expenses {`;
    queryString += `dpools {
        id
        address
      }`;
    for (let i = 0; i < blocks.length; i++) {
      queryString += `t${i}: dpools(
        block: {
          number: ${blocks[i]}
        }
      ) {
        id
        address
        totalDeposit
        totalInterestOwed
        totalFeeOwed
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // run the query
    await request(this.constants.GRAPHQL_ENDPOINT[networkID], query)
      .then((data: QueryResult) => this.handleData(data, networkID, blocks))
      .catch((error) => {
        console.error(error);
      });
  }

  async loadDataV2() {
    // fetch timestamps and blocks
    const [timestamps, blocks] = await this.timeseries.getCustomTimeSeries(
      this.FIRST_INDEX[this.constants.CHAIN_ID.V2],
      this.PERIOD,
      this.constants.CHAIN_ID.MAINNET
    );

    this.v2Timestamps = timestamps;

    // change everything array to largest timestamp array
    if (timestamps.length > this.everythingTimestamps.length) {
      this.everythingTimestamps = timestamps;
    }

    // generate the query
    let allData: QueryResultV2;
    let count: number = 0;

    while (count < this.v2Timestamps.length) {
      let limit = this.v2Timestamps.length - count;
      if (limit > 300) {
        limit = 300;
      }

      let queryString = `query ExpensesV2 {`;
      if (count === 0) {
        queryString += `dpools {
          address
        }`;
      }
      for (let i = count; i < count + limit; i++) {
        queryString += `t${i}: dpools(
          block: {
            number: ${blocks[i]}
          }
        ) {
          address
          totalActiveDeposit
          deposits (
            where: {
              active: true
            }
          ) {
            interestEarned
          }
        }`;
      }
      queryString += `}`;
      const query = gql`
        ${queryString}
      `;

      // run the query
      const data: QueryResultV2 = await request(
        this.constants.GRAPHQL_ENDPOINT_V2[this.constants.CHAIN_ID.MAINNET],
        query
      ).then((data: QueryResultV2) => {
        return data;
      });
      count += limit;
      allData = {
        ...allData,
        ...data,
      };
    }

    await this.handleDataV2(allData, blocks);
  }

  async loadEarningsData(networkID: number, blocks: number[]) {
    // generate the query
    let queryString = `query Earnings {`;
    for (let i = 0; i < blocks.length; i++) {
      queryString += `t${i}: dpools(
        block: {
          number: ${blocks[i]}
        }
      ) {
        id
        address
        oracleInterestRate
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // run the query
    await request(
      this.constants.BACK_TO_THE_FUTURE_GRAPHQL_ENDPOINT[networkID],
      query
    )
      .then((data: QueryResult) =>
        this.handleEarningsData(data, networkID, blocks)
      )
      .catch((error) => {
        console.error(error);
      });
  }

  async handleData(data: QueryResult, networkID: number, blocks: number[]) {
    let result = data;
    let dpools = result.dpools;
    let chainData: DataObject[] = [];

    // build empty data structure
    for (let i in dpools) {
      let poolInfo = this.contract.getPoolInfoFromAddress(
        dpools[i].address,
        networkID
      );
      let dataobj: DataObject;
      dataobj = {
        label: poolInfo.name,
        address: dpools[i].address,
        networkID: networkID,
        data: new Array(Object.keys(result).length - 1).fill(0),
        interestEarned: new Array(Object.keys(result).length - 1).fill(0),
        interestExpenses: new Array(Object.keys(result).length - 1).fill(0),
        totalDeposits: new Array(Object.keys(result).length - 1).fill(0),
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
      chainData.push(dataobj);
    }

    for (let i in result) {
      if (i !== 'dpools') {
        // populate deposit and expense arrays
        for (let p in result[i]) {
          const pool = result[i][p];
          const entry = chainData.find((x) => x.address === pool.address);

          const totalDeposit =
            parseFloat(pool.totalDeposit) >
            parseFloat(this.constants.DUST_THRESHOLD)
              ? parseFloat(pool.totalDeposit)
              : 0;
          entry.totalDeposits[parseInt(i.substring(1))] = totalDeposit;

          entry.interestExpenses[parseInt(i.substring(1))] =
            parseFloat(pool.totalInterestOwed) + parseFloat(pool.totalFeeOwed);
        }
      }
    }

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
    }

    await this.loadEarningsData(networkID, blocks);
  }

  async handleDataV2(data: QueryResultV2, blocks: number[]) {
    let result = data;
    let dpools = result.dpools;
    let chainData: DataObject[] = [];

    // build empty data structure
    for (let i in dpools) {
      let poolInfo = this.contract.getPoolInfoFromAddress(
        dpools[i].address,
        this.constants.CHAIN_ID.MAINNET,
        true
      );
      let dataobj: DataObject;
      dataobj = {
        label: poolInfo.name,
        address: dpools[i].address,
        networkID: this.constants.CHAIN_ID.V2,
        data: new Array(Object.keys(result).length - 1).fill(0),
        interestEarned: new Array(Object.keys(result).length - 1).fill(0),
        interestExpenses: new Array(Object.keys(result).length - 1).fill(0),
        totalDeposits: new Array(Object.keys(result).length - 1).fill(0),
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
      chainData.push(dataobj);
    }

    for (let i in result) {
      if (i !== 'dpools') {
        // populate deposit and expense arrays
        for (let p in result[i]) {
          const pool = result[i][p];
          const entry = chainData.find((x) => x.address === pool.address);

          const totalDeposit = parseFloat(pool.totalActiveDeposit);
          entry.totalDeposits[parseInt(i.substring(1))] = totalDeposit;

          let interestExpenses: number = 0;
          for (let d in pool.deposits) {
            const deposit = pool.deposits[d];
            interestExpenses =
              interestExpenses + parseFloat(deposit.interestEarned);
          }
          entry.interestExpenses[parseInt(i.substring(1))] = interestExpenses;
        }
      }
    }

    chainData.sort((a, b) => {
      return a.label > b.label ? 1 : a.label < b.label ? -1 : 0;
    });

    this.v2Data = chainData;

    await this.loadEarningsData(this.constants.CHAIN_ID.V2, blocks);
  }

  async handleEarningsData(
    data: QueryResult,
    networkID: number,
    blocks: number[]
  ) {
    let result = data;

    let chainData;
    switch (networkID) {
      case this.constants.CHAIN_ID.MAINNET:
        chainData = this.ethereumData;
        break;
      case this.constants.CHAIN_ID.POLYGON:
        chainData = this.polygonData;
        break;
      case this.constants.CHAIN_ID.AVALANCHE:
        chainData = this.avalancheData;
        break;
      case this.constants.CHAIN_ID.FANTOM:
        chainData = this.fantomData;
        break;
      case this.constants.CHAIN_ID.V2:
        chainData = this.v2Data;
        break;
    }

    for (let i in result) {
      for (let p in result[i]) {
        const pool = result[i][p];
        const entry = chainData.find((x) => x.address === pool.address);
        const deposits = entry.totalDeposits[parseInt(i.substring(1))];
        const interestRate = this.helpers.parseInterestRate(
          new BigNumber(pool.oracleInterestRate),
          this.constants.YEAR_IN_SEC
        );
        const interestEarned = interestRate.times(deposits);
        entry.interestEarned[parseInt(i.substring(1))] =
          interestEarned.toNumber();
      }
    }

    // calculate NIM
    for (let i in chainData) {
      if (chainData[i].label) {
        for (let t = 0; t < blocks.length; t++) {
          const earnings = chainData[i].interestEarned[t];
          const expenses = chainData[i].interestExpenses[t];
          const deposits = chainData[i].totalDeposits[t];
          const data = (earnings - expenses) / deposits;

          isNaN(data) || data === -Infinity
            ? (chainData[i].data[t] = 0)
            : (chainData[i].data[t] = data * 100);
        }
      }
    }
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
    } else if (this.PERIOD_NAME === 'weekly') {
      this.PERIOD = this.constants.WEEK_IN_SEC;
    } else if (this.PERIOD_NAME === 'monthly') {
      this.PERIOD = this.constants.MONTH_IN_SEC;
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
    totalDeposit: number;
    totalInterestOwed: number;
    totalFeeOwed: number;
    oracleInterestRate: number;
  }[];
}

interface QueryResultV2 {
  dpools: {
    address: string;
    totalActiveDeposit: string;
    deposits: {
      interestEarned: string;
    }[];
  }[];
}

interface DataObject {
  label: string;
  address: string;
  networkID: number;
  data: number[];
  interestEarned: number[];
  interestExpenses: number[];
  totalDeposits: number[];
  borderColor: string;
  hoverBorderColor: string;
  pointBorderColor: string;
  pointBackgroundColor: string;
  pointHoverBorderColor: string;
  pointHoverBackgroundColor: string;
  fill: boolean;
}
