import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { BondsComponent } from './bonds/bonds.component';
import { FundingComponent } from './funding/funding.component';
import { DisclaimerComponent } from './disclaimer/disclaimer.component';
import { TosContentComponent } from './tos-content/tos-content.component';
import { BridgeComponent } from './bridge/bridge.component';
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
  {
    path: 'disclaimer',
    component: DisclaimerComponent,
  },
  {
    path: 'tos',
    component: TosContentComponent,
  },
  {
    path: 'bridge',
    component: BridgeComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
