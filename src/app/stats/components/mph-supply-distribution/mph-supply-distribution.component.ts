import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import BigNumber from 'bignumber.js';

import { MphService } from 'src/app/services/token/mph.service';
import { HelpersService } from 'src/app/helpers.service';

@Component({
  selector: 'app-mph-supply-distribution',
  templateUrl: './mph-supply-distribution.component.html',
  styleUrls: ['./mph-supply-distribution.component.css'],
})
export class MphSupplyDistributionComponent implements OnInit {
  @Input() displaySetting: string;

  period: number = 7;
  loading: boolean;

  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(public mph: MphService, public helpers: HelpersService) {}

  ngOnInit(): void {
    this.loading = true;
    this.drawChart();

    this.mph.loadedEvent.subscribe(() => {
      this.drawChart();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes.displaySetting.firstChange) {
      this.drawChart();
    }
  }

  drawChart() {
    if (!this.mph.supplyDistribution.community) return;

    this.barChartOptions = {
      scaleShowVerticalLines: false,
      responsive: true,
      animation: false,
      scales: {
        xAxes: [
          {
            stacked: true,
            gridLines: {
              display: false,
            },
            ticks: {
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              maxTicksLimit: 10,
            },
          },
        ],
        yAxes: [
          {
            stacked: true,
            gridLines: {
              display: true,
              color: 'rgba(36, 37, 38, 0.5)',
            },
            scaleLabel: {
              display: false,
            },
            ticks: {
              maxTicksLimit: 10,
              callback: (label, index, labels) => {
                const bn = this.helpers.formatBN(new BigNumber(label));
                const value = bn[1] ? bn[0].toFormat(1) : bn[0].toFormat(0);
                const magnitude = bn[1] ? bn[1] : '';
                return value + magnitude;
              },
            },
          },
        ],
      },
      tooltips: {
        callbacks: {
          label: (tooltipItem, data) => {
            const address = data.datasets[tooltipItem.datasetIndex].label;
            const bn = this.helpers.formatBN(new BigNumber(tooltipItem.yLabel));
            const value = bn[1] ? bn[0].toFormat(1) : bn[0].toFormat(0);
            const magnitude = bn[1] ? bn[1] : '';
            return address + ': ' + value + magnitude;
          },
        },
      },
    };
    this.barChartType = 'bar';
    this.barChartLegend = false;

    this.barChartLabels = this.mph.supplyDistribution.labels.reduce(
      (a, e, i) => {
        if (i % this.period === 0) {
          a.push(e);
        }
        return a;
      },
      []
    );

    this.barChartData = [
      ...(this.mph.supplyDistribution.community
        ? [
            {
              data: this.mph.supplyDistribution.community.reduce((a, e, i) => {
                if (i % this.period === 0) {
                  a.push(e);
                }
                return a;
              }, []),
              label: 'Community',
              backgroundColor: 'rgba(149, 170, 201, 0.5)',
              hoverBackgroundColor: 'rgba(149, 170, 201, 1)',
            },
          ]
        : []),
      ...(this.mph.supplyDistribution.governanceTreasury
        ? [
            {
              data: this.mph.supplyDistribution.governanceTreasury.reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Governance Treasury',
              backgroundColor: 'rgba(107, 94, 174, 0.5)',
              hoverBackgroundColor: 'rgba(107, 94, 174, 1)',
            },
          ]
        : []),
      ...(this.mph.supplyDistribution.developerWallet
        ? [
            {
              data: this.mph.supplyDistribution.developerWallet.reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Developer Wallet',
              backgroundColor: 'rgba(114, 125, 245, 0.5)',
              hoverBackgroundColor: 'rgba(114, 125, 245, 1)',
            },
          ]
        : []),
      ...(this.mph.supplyDistribution.merkleDistributor
        ? [
            {
              data: this.mph.supplyDistribution.merkleDistributor.reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Merkle Distributor',
              backgroundColor: 'rgba(230, 55, 87, 0.5)',
              hoverBackgroundColor: 'rgba(230, 55, 87, 1)',
            },
          ]
        : []),
      ...(this.mph.supplyDistribution.staked
        ? [
            {
              data: this.mph.supplyDistribution.staked.reduce((a, e, i) => {
                if (i % this.period === 0) {
                  a.push(e);
                }
                return a;
              }, []),
              label: 'xMPH',
              backgroundColor: 'rgba(246, 195, 67, 0.5)',
              hoverBackgroundColor: 'rgba(246, 195, 67, 1)',
            },
          ]
        : []),
      // ...(this.uniswap.v3_liquidity.data
      //   ? [{
      //     data: this.padData(this.uniswap.v3_liquidity.data).reduce((a, e, i) => {
      //       if (i % this.period === 0) {
      //         a.push(e);
      //       }
      //       return a;
      //     }, []),
      //     label: 'Uniswap V3',
      //     backgroundColor: 'rgba(75, 179, 154, 0.5)',
      //     hoverBackgroundColor: 'rgba(75, 179, 154, 1)',
      //   }]
      //   : []
      // ),
      // ...(this.sushiswap.liquidity.data
      //   ? [{
      //     data: this.padData(this.sushiswap.liquidity.data).reduce((a, e, i) => {
      //       if (i % this.period === 0) {
      //         a.push(e);
      //       }
      //       return a;
      //     }, []),
      //     label: 'Sushiswap',
      //     backgroundColor: 'rgba(3, 184, 255, 0.5)',
      //     hoverBackgroundColor: 'rgba(3, 184, 255, 1)',
      //   }]
      //   : []
      // ),
      // ...(this.balancer.liquidity.data
      //   ? [{
      //     data: this.padData(this.balancer.liquidity.data).reduce((a, e, i) => {
      //       if (i % this.period === 0) {
      //         a.push(e);
      //       }
      //       return a;
      //     }, []),
      //     label: 'Balancer',
      //     backgroundColor: 'rgba(232, 65, 66, 0.5)',
      //     hoverBackgroundColor: 'rgba(232, 65, 66, 1)',
      //   }]
      //   : []
      // )
    ];

    this.loading = false;
  }

  changePeriod(interval: number) {
    this.period = interval;
    this.loading = true;
    this.drawChart();
  }
}
