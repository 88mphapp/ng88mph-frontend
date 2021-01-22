import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GraphQLModule } from './graphql.module';
import { HttpClientModule } from '@angular/common/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { DepositComponent } from './deposit/deposit.component';
import { ModalDepositComponent } from './deposit/modal-deposit/modal-deposit.component';
import { ModalWithdrawComponent } from './deposit/modal-withdraw/modal-withdraw.component';
import { RewardsComponent } from './rewards/rewards.component';
import { ModalStakeComponent } from './rewards/modal-stake/modal-stake.component';
import { BondsComponent } from './bonds/bonds.component';
import { ModalBondDetailsComponent } from './bonds/modal-bond-details/modal-bond-details.component';
import { StatsComponent } from './stats/stats.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { HeaderComponent } from './header/header.component';
import { FarmingComponent } from './farming/farming.component';
import { ModalStakeLPComponent } from './farming/modal-stake-lp/modal-stake-lp.component';
import { ClaimETHComponent } from './claim-eth/claim-eth.component';
import { ClaimMPHComponent } from './claim-mph/claim-mph.component';
import { VestingComponent } from './vesting/vesting.component';
import { ModalUnstakeComponent } from './rewards/modal-unstake/modal-unstake.component';
import { ModalUnstakeLPComponent } from './farming/modal-unstake-lp/modal-unstake-lp.component';
import { SyncWarningComponent } from './sync-warning/sync-warning.component';

@NgModule({
  declarations: [
    AppComponent,
    DepositComponent,
    ModalDepositComponent,
    ModalWithdrawComponent,
    RewardsComponent,
    ModalStakeComponent,
    BondsComponent,
    ModalBondDetailsComponent,
    StatsComponent,
    SidebarComponent,
    HeaderComponent,
    FarmingComponent,
    ModalStakeLPComponent,
    ClaimETHComponent,
    ClaimMPHComponent,
    VestingComponent,
    ModalUnstakeComponent,
    ModalUnstakeLPComponent,
    SyncWarningComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    GraphQLModule,
    HttpClientModule,
    NgbModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
