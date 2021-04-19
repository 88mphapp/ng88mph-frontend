import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import BigNumber from 'bignumber.js';
import { AppComponent } from '../app.component';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { Watch } from '../watch';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  mphBalance: BigNumber;

  watchedModel = new Watch(false, "");

  constructor(public route: Router, public wallet: WalletService, public contract: ContractService,
    public constants: ConstantsService, public app: AppComponent) {
    this.resetData();
  }

  ngOnInit(): void {
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    if (!this.wallet.connected) {
      return;
    }
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const mphToken = this.contract.getNamedContract('MPHToken', readonlyWeb3);
    const rewards = this.contract.getNamedContract('Rewards', readonlyWeb3);

    let mphBalance, stakedMPHBalance, address;

    if (!this.wallet.watching) {
      address = this.wallet.userAddress;
    } else {
      address = this.wallet.watchedAddress;
    }
    await Promise.all([
      mphBalance = new BigNumber(await mphToken.methods.balanceOf(address).call()).div(this.constants.PRECISION),
      stakedMPHBalance = new BigNumber(await rewards.methods.balanceOf(address).call()).div(this.constants.PRECISION)
    ])
    this.mphBalance = new BigNumber(mphBalance);
  }

  resetData(): void {
    this.mphBalance = new BigNumber(0);
  }

  connectWallet() {
    this.wallet.connect(() => { }, () => { }, false);
  }

  onSubmit() {
    this.wallet.watchWallet(this.watchedModel.address);
    this.loadData();
  }

  switchFocus(watching: boolean) {
    this.wallet.watch.watching = watching;
    this.loadData();
  }

}
