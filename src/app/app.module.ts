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
import { ModalWithdrawZCBComponent } from './deposit/modal-withdraw-zcb/modal-withdraw-zcb.component';
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
import { ScrollingModule } from '@angular/cdk/scrolling';
import { HistoricalAssetTvlComponent } from './stats/components/historical-asset-tvl/historical-asset-tvl.component';
import { MphSupplyDistributionComponent } from './stats/components/mph-supply-distribution/mph-supply-distribution.component';
import { HistoricalFixedInterestRatesComponent } from './stats/components/historical-fixed-interest-rates/historical-fixed-interest-rates.component';
import { FundedInterestExpensesComponent } from './stats/components/funded-interest-expenses/funded-interest-expenses.component';
import { ModalWithdrawYieldTokenInterestComponent } from './bonds/modal-withdraw-yield-token-interest/modal-withdraw-yield-token-interest.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingPageComponent,
    DepositComponent,
    ModalDepositComponent,
    ModalWithdrawComponent,
    ModalWithdrawZCBComponent,
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
    HistoricalAssetTvlComponent,
    MphSupplyDistributionComponent,
    HistoricalFixedInterestRatesComponent,
    FundedInterestExpensesComponent,
    ModalWithdrawYieldTokenInterestComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    NgbModule,
    FormsModule,
    ChartsModule,
    ScrollingModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
