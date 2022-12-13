import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import BigNumber from 'bignumber.js';

import { BalancerService } from 'src/app/services/liquidity/balancer.service';
import { SushiswapService } from 'src/app/services/liquidity/sushiswap.service';
import { UniswapService } from 'src/app/services/liquidity/uniswap.service';
import { HelpersService } from 'src/app/helpers.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-mph-liquidity',
  templateUrl: './mph-liquidity.component.html',
  styleUrls: ['./mph-liquidity.component.css'],
})
export class MphLiquidityComponent implements OnInit {
  @Input() displaySetting: string;

  period: number = 7;
  loading: boolean;

  public barChartOptions;
  public barChartLabels;
  public barChartType;
  public barChartLegend;
  public barChartData;

  constructor(
    public balancer: BalancerService,
    public sushiswap: SushiswapService,
    public uniswap: UniswapService,
    public helpers: HelpersService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.drawChart();

    this.balancer.loadedEvent.subscribe(() => {
      this.drawChart();
    });
    this.uniswap.loadedEvent.subscribe(() => {
      this.drawChart();
    });
    this.sushiswap.loadedEvent.subscribe(() => {
      this.drawChart();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes.displaySetting.firstChange) {
      this.drawChart();
    }
  }

  drawChart() {
    if (
      !this.balancer.liquidity.data ||
      !this.sushiswap.liquidity.data ||
      !this.uniswap.v2_liquidity.data ||
      !this.uniswap.v3_liquidity.data
    ) {
      return;
    }

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

    this.barChartLabels = this.uniswap.v2_liquidity.labels.reduce((a, e, i) => {
      if (i % this.period === 0) {
        a.push(e);
      }
      return a;
    }, []);

    this.barChartData = [
      ...(this.uniswap.v2_liquidity.data
        ? [
            {
              data: this.padData(this.uniswap.v2_liquidity.data).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Uniswap V2',
              backgroundColor: 'rgba(221, 107, 229, 0.5)',
              hoverBackgroundColor: 'rgba(221, 107, 229, 1)',
            },
          ]
        : []),
      ...(this.uniswap.v3_liquidity.data
        ? [
            {
              data: this.padData(this.uniswap.v3_liquidity.data).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Uniswap V3',
              backgroundColor: 'rgba(75, 179, 154, 0.5)',
              hoverBackgroundColor: 'rgba(75, 179, 154, 1)',
            },
          ]
        : []),
      ...(this.sushiswap.liquidity.data
        ? [
            {
              data: this.padData(this.sushiswap.liquidity.data).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Sushiswap',
              backgroundColor: 'rgba(3, 184, 255, 0.5)',
              hoverBackgroundColor: 'rgba(3, 184, 255, 1)',
            },
          ]
        : []),
      ...(this.balancer.liquidity.data
        ? [
            {
              data: this.padData(this.balancer.liquidity.data).reduce(
                (a, e, i) => {
                  if (i % this.period === 0) {
                    a.push(e);
                  }
                  return a;
                },
                []
              ),
              label: 'Balancer',
              backgroundColor: 'rgba(232, 65, 66, 0.5)',
              hoverBackgroundColor: 'rgba(232, 65, 66, 1)',
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
    const length = this.uniswap.v2_liquidity.data.length - data.length;
    const padding = Array.apply(0, Array(length));
    return [...padding, ...data];
  }
}
