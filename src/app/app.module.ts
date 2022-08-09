// modules
import { AppRoutingModule } from './app-routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BrowserModule } from '@angular/platform-browser';
import { ChartsModule } from 'ng2-charts';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

// components
import { AppComponent } from './app.component';
import { BridgeComponent } from './bridge/bridge.component';
import { FundingComponent } from './funding/funding.component';
import { GaugeComponent } from './gauge/gauge.component';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { ModalTransactionAlertsComponent } from './modal-transaction-alerts/modal-transaction-alerts.component';
import { SyncWarningComponent } from './sync-warning/sync-warning.component';
import { TermsOfServiceComponent } from './terms-of-service/terms-of-service.component';

import { DepositComponent } from './deposit/deposit.component';
import { ModalDepositComponent } from './deposit/modal-deposit/modal-deposit.component';
import { ModalMphRewardsComponent } from './deposit/modal-mph-rewards/modal-mph-rewards.component';
import { ModalNftComponent } from './deposit/modal-nft/modal-nft.component';
import { ModalRollOverComponent } from './deposit/modal-roll-over/modal-roll-over.component';
import { ModalTopUpComponent } from './deposit/modal-top-up/modal-top-up.component';
import { ModalWithdrawComponent } from './deposit/modal-withdraw/modal-withdraw.component';
import { ModalWithdrawZCBComponent } from './deposit/modal-withdraw-zcb/modal-withdraw-zcb.component';

import { BondsComponent } from './bonds/bonds.component';
import { ModalBuyYieldTokenComponent } from './bonds/modal-buy-yield-token/modal-buy-yield-token.component';
import { ModalWithdrawYieldTokenInterestComponent } from './bonds/modal-withdraw-yield-token-interest/modal-withdraw-yield-token-interest.component';

import { FarmingComponent } from './farming/farming.component';
import { ModalStakeLPComponent } from './farming/modal-stake-lp/modal-stake-lp.component';
import { ModalUnstakeLPComponent } from './farming/modal-unstake-lp/modal-unstake-lp.component';

import { RewardsComponent } from './rewards/rewards.component';
import { ModalUnstakeComponent } from './rewards/modal-unstake/modal-unstake.component';

import { StatsComponent } from './stats/stats.component';
import { FundedInterestExpensesComponent } from './stats/components/funded-interest-expenses/funded-interest-expenses.component';
import { HistoricalAssetTvlComponent } from './stats/components/historical-asset-tvl/historical-asset-tvl.component';
import { HistoricalFixedInterestRatesComponent } from './stats/components/historical-fixed-interest-rates/historical-fixed-interest-rates.component';
import { HistoricalStakingRewardsComponent } from './stats/components/historical-staking-rewards/historical-staking-rewards.component';
import { LossProvisionComponent } from './stats/components/loss-provision/loss-provision.component';
import { MphLiquidityComponent } from './stats/components/mph-liquidity/mph-liquidity.component';
import { MphSupplyDistributionComponent } from './stats/components/mph-supply-distribution/mph-supply-distribution.component';
import { NetInterestMarginComponent } from './stats/components/net-interest-margin/net-interest-margin.component';
import { PriceEarningsRatioComponent } from './stats/components/price-earnings-ratio/price-earnings-ratio.component';
import { XmphSupplyDistributionComponent } from './stats/components/xmph-supply-distribution/xmph-supply-distribution.component';

import { HeaderComponent } from './header/header.component';
import { DepositFeedComponent } from './header/deposit-feed/deposit-feed.component';
import { ConverterComponent } from './bridge/converter/converter.component';

// other
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { CacheInterceptor } from './cache-interceptor';

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
    StatsComponent,
    HeaderComponent,
    FarmingComponent,
    ModalStakeLPComponent,
    FundingComponent,
    BridgeComponent,
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
    NetInterestMarginComponent,
    TermsOfServiceComponent,
    ModalTransactionAlertsComponent,
    ModalNftComponent,
    LossProvisionComponent,
    HistoricalStakingRewardsComponent,
    PriceEarningsRatioComponent,
    XmphSupplyDistributionComponent,
    DepositFeedComponent,
    GaugeComponent,
    ConverterComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    NgbModule,
    FormsModule,
    ChartsModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
