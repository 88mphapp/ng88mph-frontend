import { Component, OnInit } from '@angular/core';

import { StatisticsService } from 'src/app/services/analytics/statistics.service';
import { ChartsService } from 'src/app/services/analytics/charts.service';
import { MphService } from 'src/app/services/token/mph.service';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css'],
})
export class StatsComponent implements OnInit {
  displaySetting: string;

  constructor(
    public statistics: StatisticsService,
    public charts: ChartsService,
    public mph: MphService
  ) {
    this.resetData();
  }

  ngOnInit(): void {}

  resetData(): void {
    this.displaySetting = 'all';
  }
}
