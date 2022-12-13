import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import BigNumber from 'bignumber.js';

import { ChartsService } from 'src/app/services/analytics/charts.service';
import { HelpersService } from 'src/app/helpers.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-loss-provision',
  templateUrl: './loss-provision.component.html',
  styleUrls: ['./loss-provision.component.css'],
})
export class LossProvisionComponent implements OnInit {
  @Input() displaySetting: string;

  period: number = 7;
  loading: boolean;

  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(public chart: ChartsService, public helpers: HelpersService) {}

  ngOnInit(): void {
    this.loading = true;
    this.drawChart();

    this.chart.loadedEvent.subscribe(() => {
      this.drawChart();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes.displaySetting.firstChange) {
      this.drawChart();
    }
  }

  drawChart() {
    if (Object.keys(this.chart.mainnet).length === 0) return;

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
                return '$' + value + magnitude;
              },
            },
          },
        ],
      },
      tooltips: {
        callbacks: {
          label: (tooltipItem, data) => {
            const chain = data.datasets[tooltipItem.datasetIndex].label;
            const bn = this.helpers.formatBN(new BigNumber(tooltipItem.yLabel));
            const value = bn[1] ? bn[0].toFormat(1) : bn[0].toFormat(0);
            const magnitude = bn[1] ? bn[1] : '';
            return chain + ': ' + '$' + value + magnitude;
          },
        },
      },
    };
    this.barChartType = 'bar';
    this.barChartLegend = false;

    this.barChartLabels = this.displaySetting.match(/^(all)$/)
      ? this.chart.mainnet.labels.reduce((a, e, i) => {
          if (i % this.period === 0) {
            a.push(e);
          }
          return a;
        }, [])
      : this.chart[`${this.displaySetting}`].labels.reduce((a, e, i) => {
          if (i % this.period === 0) {
            a.push(e);
          }
          return a;
        }, []);

    this.barChartData = [
      ...(this.displaySetting.match(/^(all|avalanche)$/)
        ? [
            {
              data: this.padData(this.chart.avalanche.loanLossReserve).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Avalanche',
              backgroundColor: 'rgba(232, 65, 66, 0.5)',
              hoverBackgroundColor: 'rgba(232, 65, 66, 1)',
            },
          ]
        : []),
      ...(this.displaySetting.match(/^(all|mainnet)$/)
        ? [
            {
              data: this.padData(this.chart.mainnet.loanLossReserve).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Ethereum',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              hoverBackgroundColor: 'rgba(255, 255, 255, 1)',
            },
          ]
        : []),
      ...(this.displaySetting.match(/^(all|polygon)$/)
        ? [
            {
              data: this.padData(this.chart.polygon.loanLossReserve).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Polygon',
              backgroundColor: 'rgba(123, 63, 228, 0.5)',
              hoverBackgroundColor: 'rgba(123, 63, 228, 1)',
            },
          ]
        : []),
      ...(this.displaySetting.match(/^(all|fantom)$/)
        ? [
            {
              data: this.padData(this.chart.fantom.loanLossReserve).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Fantom',
              backgroundColor: 'rgba(25, 105, 255, 0.5)',
              hoverBackgroundColor: 'rgba(25, 105, 255, 1)',
            },
          ]
        : []),
    ];

    this.loading = false;
  }

  changePeriod(interval: number) {
    this.period = interval;
    this.loading = true;
    this.drawChart();
  }

  padData(data: number[]) {
    if (!this.displaySetting.match(/^all$/)) return data;

    const length = this.chart.mainnet.labels.length - data.length;
    const padding = Array.apply(0, Array(length));
    return [...padding, ...data];
  }
}
