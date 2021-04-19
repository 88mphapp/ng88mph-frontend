import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BondsComponent } from './bonds/bonds.component';
import { FundingComponent } from './funding/funding.component';
import { ClaimETHComponent } from './claim-eth/claim-eth.component';
import { ClaimMPHComponent } from './claim-mph/claim-mph.component';
import { DepositComponent } from './deposit/deposit.component';
import { FarmingComponent } from './farming/farming.component';
import { RewardsComponent } from './rewards/rewards.component';
import { StatsComponent } from './stats/stats.component';
import { VestingComponent } from './vesting/vesting.component';
import { ZeroCouponBondsComponent } from './zero-coupon-bonds/zero-coupon-bonds.component';

const routes: Routes = [
  {
    path: '',
    component: DepositComponent,
    pathMatch: 'full'
  },
  {
    path: 'deposits',
    component: DepositComponent
  },
  {
    path: 'bonds',
    component: BondsComponent
  },
  {
    path: 'zero-coupon-bonds',
    component: ZeroCouponBondsComponent
  },
  {
    path: 'rewards',
    component: RewardsComponent
  },
  {
    path: 'stats',
    component: StatsComponent
  },
  {
    path: 'farming',
    component: FarmingComponent
  },
  {
    path: 'vesting',
    component: VestingComponent
  },
  {
    path: 'funding',
    component: FundingComponent
  },
  {
    path: 'claim-eth',
    component: ClaimETHComponent
  },
  {
    path: 'claim-mph',
    component: ClaimMPHComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
