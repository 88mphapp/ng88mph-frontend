import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BondsComponent } from './bonds/bonds.component';
import { ClaimETHComponent } from './claim-eth/claim-eth.component';
import { ClaimMPHComponent } from './claim-mph/claim-mph.component';
import { DepositComponent } from './deposit/deposit.component';
import { ZeroCouponBondComponent } from './zero-coupon-bond/zero-coupon-bond.component';
import { FarmingComponent } from './farming/farming.component';
import { RewardsComponent } from './rewards/rewards.component';
import { StatsComponent } from './stats/stats.component';
import { VestingComponent } from './vesting/vesting.component';

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
    path: 'zero-coupon-bonds',
    component: ZeroCouponBondComponent
  },
  {
    path: 'bonds',
    component: BondsComponent
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
    path: 'claim-eth',
    component: ClaimETHComponent
  },
  {
    path: 'claim-mph',
    component: ClaimMPHComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
