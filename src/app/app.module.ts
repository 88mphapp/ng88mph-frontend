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
import { FundingComponent } from './funding/funding.component';
import { ClaimETHComponent } from './claim-eth/claim-eth.component';
import { ClaimMPHComponent } from './claim-mph/claim-mph.component';
import { VestingComponent } from './vesting/vesting.component';
import { ModalUnstakeComponent } from './rewards/modal-unstake/modal-unstake.component';
import { ModalUnstakeLPComponent } from './farming/modal-unstake-lp/modal-unstake-lp.component';
import { SyncWarningComponent } from './sync-warning/sync-warning.component';
import { ZeroCouponBondsComponent } from './zero-coupon-bonds/zero-coupon-bonds.component';
import { ModalZeroCouponBondInfoComponent } from './zero-coupon-bonds/modal-zero-coupon-bond-info/modal-zero-coupon-bond-info.component';
import { MintZeroCouponBondComponent } from './zero-coupon-bonds/modal-zero-coupon-bond-info/mint-zero-coupon-bond/mint-zero-coupon-bond.component';
import { RedeemZeroCouponBondComponent } from './zero-coupon-bonds/modal-zero-coupon-bond-info/redeem-zero-coupon-bond/redeem-zero-coupon-bond.component';
import { WithdrawZeroCouponBondComponent } from './zero-coupon-bonds/modal-zero-coupon-bond-info/withdraw-zero-coupon-bond/withdraw-zero-coupon-bond.component';
import { FarmZeroCouponBondComponent } from './zero-coupon-bonds/modal-zero-coupon-bond-info/farm-zero-coupon-bond/farm-zero-coupon-bond.component';
import { ModalStakeZCBLPComponent } from './zero-coupon-bonds/modal-zero-coupon-bond-info/farm-zero-coupon-bond/modal-stake-zcblp/modal-stake-zcblp.component';
import { ModalUnstakeZCBLPComponent } from './zero-coupon-bonds/modal-zero-coupon-bond-info/farm-zero-coupon-bond/modal-unstake-zcblp/modal-unstake-zcblp.component';
import { MphSupplyDistributionComponent } from './stats/components/mph-supply-distribution/mph-supply-distribution.component';
import { ChartsModule } from 'ng2-charts';
import { HistoricalStakingRewardsComponent } from './stats/components/historical-staking-rewards/historical-staking-rewards.component';
import { HistoricalFixedInterestRatesComponent } from './stats/components/historical-fixed-interest-rates/historical-fixed-interest-rates.component';
import { HistoricalAssetTvlComponent } from './stats/components/historical-asset-tvl/historical-asset-tvl.component';
import { HistoricalMphPeRatioComponent } from './stats/components/historical-mph-pe-ratio/historical-mph-pe-ratio.component';
import { MphLiquidityComponent } from './stats/components/mph-liquidity/mph-liquidity.component';
import { NetInterestMarginComponent } from './stats/components/net-interest-margin/net-interest-margin.component';
import { FundedInterestExpensesComponent } from './stats/components/funded-interest-expenses/funded-interest-expenses.component';
import { LossProvisionComponent } from './stats/components/loss-provision/loss-provision.component';

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
    FundingComponent,
    ClaimETHComponent,
    ClaimMPHComponent,
    VestingComponent,
    ModalUnstakeComponent,
    ModalUnstakeLPComponent,
    SyncWarningComponent,
    ZeroCouponBondsComponent,
    ModalZeroCouponBondInfoComponent,
    MintZeroCouponBondComponent,
    RedeemZeroCouponBondComponent,
    WithdrawZeroCouponBondComponent,
    FarmZeroCouponBondComponent,
    ModalStakeZCBLPComponent,
    ModalUnstakeZCBLPComponent,
    MphSupplyDistributionComponent,
    HistoricalStakingRewardsComponent,
    HistoricalFixedInterestRatesComponent,
    HistoricalAssetTvlComponent,
    HistoricalMphPeRatioComponent,
    MphLiquidityComponent,
    NetInterestMarginComponent,
    FundedInterestExpensesComponent,
    LossProvisionComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    GraphQLModule,
    HttpClientModule,
    NgbModule,
    FormsModule,
    ChartsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
