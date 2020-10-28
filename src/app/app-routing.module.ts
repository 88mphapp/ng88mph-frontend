import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BondsComponent } from './bonds/bonds.component';
import { DepositComponent } from './deposit/deposit.component';
import { RewardsComponent } from './rewards/rewards.component';
import { StatsComponent } from './stats/stats.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'deposits',
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
    path: 'rewards',
    component: RewardsComponent
  },
  {
    path: 'stats',
    component: StatsComponent
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
