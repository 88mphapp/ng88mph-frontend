import { Component, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app//helpers.service';
import { WalletService } from 'src/app//wallet.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-xmph-supply-distribution',
  templateUrl: './xmph-supply-distribution.component.html',
  styleUrls: ['./xmph-supply-distribution.component.css'],
})
export class XmphSupplyDistributionComponent implements OnInit {
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
  labels: string[];
  data: number[];
  backgroundColors: string[];
  hoverBackgroundColors: string[];

  // chart variables
  public pieChartOptions;
  public pieChartLabels;
  public pieChartType;
  public pieChartLegend;
  public pieChartData;

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
    this.labels = [];
    this.data = [];
    this.backgroundColors = [];
    this.hoverBackgroundColors = [];
  }

  async drawChart() {
    // wait for data to load
    await this.loadData(this.constants.CHAIN_ID.MAINNET);

    // then draw the chart
    this.pieChartOptions = {
      responsive: true,
    };
    this.pieChartLabels = this.labels;
    this.pieChartType = 'pie';
    this.pieChartLegend = false;
    this.pieChartData = [
      {
        data: this.data,
        backgroundColor: this.backgroundColors,
        hoverBackgroundColor: this.hoverBackgroundColors,
        borderWidth: 0,
      },
    ];
  }

  loadData(networkID: number) {
    // generate the query
    let queryString = `query xmphSupplyDistribution {`;
    queryString += `mphholders (
      where: {
        xmphBalance_gt: "100"
      }
      orderBy: xmphBalance
      orderDirection: asc
      first: 1000
    ) {
      address
      xmphBalance
    }`;
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    // run the query
    request(this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[networkID], query).then(
      (data: QueryResult) => this.handleData(data)
    );
  }

  handleData(data: QueryResult) {
    const xmphHolders = data.mphholders;

    for (let holder in xmphHolders) {
      const user = xmphHolders[holder];
      this.labels[holder] = user.address;
      this.data[holder] = parseFloat(user.xmphBalance);
      this.backgroundColors[holder] =
        'rgba(' + this.COLORS[parseInt(holder) % this.COLORS.length] + ', 0.5)';
      this.hoverBackgroundColors[holder] =
        'rgba(' + this.COLORS[parseInt(holder) % this.COLORS.length] + ', 1)';
    }
  }
}

interface QueryResult {
  mphholders: {
    address: string;
    xmphBalance: string;
  }[];
}
