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
import { DataService } from 'src/app//data.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-historical-staking-rewards',
  templateUrl: './historical-staking-rewards.component.html',
  styleUrls: ['./historical-staking-rewards.component.css'],
})
export class HistoricalStakingRewardsComponent implements OnInit {
  // constants
  FIRST_INDEX = {
    [this.constants.CHAIN_ID.MAINNET]: 1630368000,
    [this.constants.CHAIN_ID.POLYGON]: 1633392000,
    [this.constants.CHAIN_ID.AVALANCHE]: 1633651200,
    [this.constants.CHAIN_ID.FANTOM]: 1633996800,
    [this.constants.CHAIN_ID.V2]: 1606176000,
  };
  PERIOD: number = this.constants.DAY_IN_SEC;
  PERIOD_NAME: string = 'daily';

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
    public datas: DataService
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
  }

  drawChart(loadData: boolean = true) {
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
          },
        ],
        yAxes: [
          {
            stacked: true,
            gridLines: {
              display: true,
              color: '#242526',
            },
            ticks: {
              suggestedMin: 0,
              callback: function (label, index, labels) {
                const x = label.toFixed(0);
                const y =
                  '$' + x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return y;
              },
            },
          },
        ],
      },
      tooltips: {
        callbacks: {
          label: function (tooltipItem, data) {
            const item = tooltipItem.yLabel.toFixed(0);
            const formattedItem =
              '$' + item.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return formattedItem;
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
      this.loadDataV2(),
    ]).then(() => {
      this.padData(this.v2Timestamps, this.v2Data);
      this.padData(this.ethereumTimestamps, this.ethereumData);
      this.padData(this.polygonTimestamps, this.polygonData);
      this.padData(this.avalancheTimestamps, this.avalancheData);
      this.padData(this.fantomTimestamps, this.fantomData);
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
    }

    // change everything array to largest timestamp array
    if (timestamps.length > this.everythingTimestamps.length) {
      this.everythingTimestamps = timestamps;
    }

    // then generate the query
    let queryString = `query HistoricaStakingRewards {`;
    for (let i = 0; i < blocks.length; i++) {
      queryString += `t${i}: globalStats(
        id: "0"
        block: {
          number: ${blocks[i]}
        }
      ) {
        xMPHRewardDistributed
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // then run the query
    await request(this.constants.GRAPHQL_ENDPOINT[networkID], query).then(
      (data: QueryResult) => this.handleData(data, networkID)
    );
  }

  async handleData(data: QueryResult, networkID) {
    let chainData: number[] = [];
    let chainDataArray: DataObject[] = [];

    for (let t in data) {
      if (data[t] != null) {
        chainData[parseInt(t.substring(1))] =
          parseFloat(data[t].xMPHRewardDistributed) *
          this.datas.mphPriceUSD.toNumber();
      } else {
        chainData[parseInt(t.substring(1))] = 0;
      }
    }

    let dataObj: DataObject;
    let label: string;
    let color: string;
    let hoverColor: string;

    switch (networkID) {
      case this.constants.CHAIN_ID.MAINNET:
        label = 'Ethereum';
        color = 'rgba(44, 123, 229, 0.5)';
        hoverColor = 'rgba(44, 123, 229, 1)';
        break;
      case this.constants.CHAIN_ID.POLYGON:
        label = 'Polygon';
        color = 'rgba(107, 94, 174, 0.5)';
        hoverColor = 'rgba(107, 94, 174, 1)';
        break;
      case this.constants.CHAIN_ID.AVALANCHE:
        label = 'Avalanche';
        color = 'rgba(230, 55, 87, 0.5)';
        hoverColor = 'rgba(230, 55, 87, 1)';
        break;
      case this.constants.CHAIN_ID.FANTOM:
        label = 'Fantom';
        color = 'rgba(25, 225, 255, 0.5)';
        hoverColor = 'rgba(25, 225, 255, 1)';
        break;
    }
    dataObj = {
      label: label,
      data: chainData,
      backgroundColor: color,
      hoverBackgroundColor: hoverColor,
    };
    chainDataArray.push(dataObj);

    // add chainData to appropriate chain variable
    switch (networkID) {
      case this.constants.CHAIN_ID.MAINNET:
        this.ethereumData = chainDataArray;
        break;
      case this.constants.CHAIN_ID.POLYGON:
        this.polygonData = chainDataArray;
        break;
      case this.constants.CHAIN_ID.AVALANCHE:
        this.avalancheData = chainDataArray;
        break;
      case this.constants.CHAIN_ID.FANTOM:
        this.fantomData = chainDataArray;
        break;
    }
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

    // then generate the query
    let queryString = `query HistoricaStakingRewardsV2 {`;
    for (let i = 0; i < blocks.length; i++) {
      queryString += `t${i}: mph(
        id: "0"
        block: {
          number: ${blocks[i]}
        }
      ) {
        totalHistoricalReward
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // then run the query
    await request(
      this.constants.GRAPHQL_ENDPOINT_V2[this.constants.CHAIN_ID.MAINNET],
      query
    ).then((data: QueryResultV2) => this.handleDataV2(data));
  }

  async handleDataV2(data: QueryResultV2) {
    let chainData: number[] = [];
    let chainDataArray: DataObject[] = [];
    for (let t in data) {
      if (data[t] != null) {
        chainData[parseInt(t.substring(1))] =
          parseFloat(data[t].totalHistoricalReward) *
          this.datas.daiPriceUSD.toNumber();
      } else {
        chainData[parseInt(t.substring(1))] = 0;
      }
    }

    const dataObj: DataObject = {
      label: 'V2',
      data: chainData,
      backgroundColor: 'rgba(246, 195, 67, 0.5)',
      hoverBackgroundColor: 'rgba(246, 195, 67, 1)',
    };
    chainDataArray.push(dataObj);

    this.v2Data = chainDataArray;
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

  changePeriod() {
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
    this.drawChart(false);
  }

  padData(timestamps: number[], data: DataObject[]) {
    let array = JSON.parse(JSON.stringify(data));
    let padArray = [];

    const delta = this.everythingTimestamps.length - timestamps.length;
    for (let i = 0; i < delta; i++) {
      padArray.push(0);
    }

    for (let x in array) {
      let xData = padArray.concat(array[x].data);
      array[x].data = xData;
    }

    this.everythingData = this.everythingData.concat(array);
  }
}

interface QueryResult {
  globalStats: {
    xMPHRewardDistributed: string;
  };
}

interface QueryResultV2 {
  mph: {
    totalHistoricalReward: string;
  };
}

interface DataObject {
  label: string;
  data: Array<number>;
  backgroundColor: string;
  hoverBackgroundColor: string;
}
