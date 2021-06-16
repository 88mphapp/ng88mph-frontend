import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { BondsComponent } from './bonds/bonds.component';
import { FundingComponent } from './funding/funding.component';
import { DepositComponent } from './deposit/deposit.component';
import { FarmingComponent } from './farming/farming.component';
import { RewardsComponent } from './rewards/rewards.component';
import { StatsComponent } from './stats/stats.component';

const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    pathMatch: 'full',
  },
  {
    path: 'earn',
    component: DepositComponent,
  },
  {
    path: 'yield',
    component: BondsComponent,
  },
  {
    path: 'stake',
    component: RewardsComponent,
  },
  {
    path: 'stats',
    component: StatsComponent,
  },
  {
    path: 'farm',
    component: FarmingComponent,
  },
  {
    path: 'funding',
    component: FundingComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
