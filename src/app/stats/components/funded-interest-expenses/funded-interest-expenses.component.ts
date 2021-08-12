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
  selector: 'app-funded-interest-expenses',
  templateUrl: './funded-interest-expenses.component.html',
  styleUrls: ['./funded-interest-expenses.component.css'],
})
export class FundedInterestExpensesComponent implements OnInit {
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
    this.lineChartData = this.data;
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

    // then generate the query
    let queryString = `query InterestExpense {`;
    queryString += `dpools {
        id
        address
      }`;
    for (let i = 0; i < this.blocks.length; i++) {
      queryString += `t${i}: dpools(
        block: {
          number: ${this.blocks[i]}
        }
      ) {
        id
        address
        totalInterestOwed
        totalFeeOwed
        fundings (
          where: {
            principalPerToken_gt: "${this.constants.DUST_THRESHOLD}"
          }
        ) {
          fundedDeficitAmount
        }
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // then run the query
    request(this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID], query).then(
      (data: QueryResult) => this.handleData(data)
    );

    return true;
  }

  async handleData(data: QueryResult) {
    let result = data;
    let dpools = result.dpools;

    // build empty data structure
    for (let i in dpools) {
      let dataobj: DataObject;
      dataobj = {
        label: dpools[i].id,
        data: [],
        interestExpenses: [],
        fundedExpenses: [],
        borderColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 0.5)',
        hoverBorderColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        pointHoverBorderColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        pointHoverBackgroundColor:
          'rgba(' + this.COLORS[parseInt(i) % this.COLORS.length] + ', 1)',
        fill: false,
      };
      this.data.push(dataobj);
    }

    // populate data structure
    for (let i in result) {
      if (i !== 'dpools') {
        // initialize dpool data arrays
        for (let x in this.data) {
          if (this.data[x].label) {
            this.data[x].interestExpenses[parseInt(i.substring(1))] = 0;
            this.data[x].fundedExpenses[parseInt(i.substring(1))] = 0;
          }
        }

        // populate dpool data arrays
        for (let p in result[i]) {
          const pool = result[i][p];
          const entry = this.data.find((x) => x.label === pool.id);
          const interestOwed = parseFloat(pool.totalInterestOwed);
          const feeOwed = parseFloat(pool.totalFeeOwed);
          entry.interestExpenses[parseInt(i.substring(1))] =
            interestOwed + feeOwed;

          let fundedDeficit = 0;
          const fundings = pool.fundings;
          for (let funding of fundings) {
            fundedDeficit += parseFloat(funding.fundedDeficitAmount);
          }
          entry.fundedExpenses[parseInt(i.substring(1))] = fundedDeficit;
        }
      }
    }

    // calculate data to be displayed
    for (let i in this.data) {
      // for each pool
      if (this.data[i].label) {
        for (let k = 0; k < this.blocks.length; k++) {
          // for each timestamp
          let percent =
            (this.data[i].fundedExpenses[k] /
              this.data[i].interestExpenses[k]) *
            100;
          if (isNaN(percent)) {
            this.data[i].data.push(0);
          } else {
            this.data[i].data.push(percent);
          }
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
    totalInterestOwed: number;
    totalFeeOwed: number;
    fundings: {
      fundedDeficitAmount: number;
    };
  }[];
}

interface DataObject {
  label: string;
  data: number[];
  interestExpenses: number[];
  fundedExpenses: number[];
  borderColor: string;
  hoverBorderColor: string;
  pointHoverBorderColor: string;
  pointHoverBackgroundColor: string;
  fill: boolean;
}
