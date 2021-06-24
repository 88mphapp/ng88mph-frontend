import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { DepositComponent } from './deposit/deposit.component';
import { ModalDepositComponent } from './deposit/modal-deposit/modal-deposit.component';
import { ModalWithdrawComponent } from './deposit/modal-withdraw/modal-withdraw.component';
import { RewardsComponent } from './rewards/rewards.component';
import { BondsComponent } from './bonds/bonds.component';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { ModalBondDetailsComponent } from './bonds/modal-bond-details/modal-bond-details.component';
import { StatsComponent } from './stats/stats.component';
import { HeaderComponent } from './header/header.component';
import { FarmingComponent } from './farming/farming.component';
import { ModalStakeLPComponent } from './farming/modal-stake-lp/modal-stake-lp.component';
import { FundingComponent } from './funding/funding.component';
import { ModalUnstakeComponent } from './rewards/modal-unstake/modal-unstake.component';
import { ModalUnstakeLPComponent } from './farming/modal-unstake-lp/modal-unstake-lp.component';
import { SyncWarningComponent } from './sync-warning/sync-warning.component';
import { ModalMphRewardsComponent } from './deposit/modal-mph-rewards/modal-mph-rewards.component';
import { ModalTopUpComponent } from './deposit/modal-top-up/modal-top-up.component';
import { ModalRollOverComponent } from './deposit/modal-roll-over/modal-roll-over.component';
import { ChartsModule } from 'ng2-charts';
import { MphLiquidityComponent } from './stats/components/mph-liquidity/mph-liquidity.component';
import { ModalBuyYieldTokenComponent } from './bonds/modal-buy-yield-token/modal-buy-yield-token.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingPageComponent,
    DepositComponent,
    ModalDepositComponent,
    ModalWithdrawComponent,
    RewardsComponent,
    BondsComponent,
    ModalBondDetailsComponent,
    StatsComponent,
    HeaderComponent,
    FarmingComponent,
    ModalStakeLPComponent,
    FundingComponent,
    ModalUnstakeComponent,
    ModalUnstakeLPComponent,
    SyncWarningComponent,
    ModalMphRewardsComponent,
    ModalTopUpComponent,
    ModalRollOverComponent,
    MphLiquidityComponent,
    ModalBuyYieldTokenComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    NgbModule,
    FormsModule,
    ChartsModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
