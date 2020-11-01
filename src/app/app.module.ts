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
import { StatsComponent } from './stats/stats.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { HeaderComponent } from './header/header.component';

@NgModule({
  declarations: [
    AppComponent,
    DepositComponent,
    ModalDepositComponent,
    ModalWithdrawComponent,
    RewardsComponent,
    ModalStakeComponent,
    BondsComponent,
    StatsComponent,
    SidebarComponent,
    HeaderComponent
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
