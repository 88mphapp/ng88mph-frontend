import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  mphBalance: BigNumber;

  constructor(public route: Router, public wallet: WalletService, public contract: ContractService,
    public constants: ConstantsService) {
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
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const mphToken = this.contract.getNamedContract('MPHToken', readonlyWeb3);
    const rewards = this.contract.getNamedContract('Rewards', readonlyWeb3);

    let mphBalance, stakedMPHBalance;
    await Promise.all([
      mphBalance = new BigNumber(await mphToken.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION),
      stakedMPHBalance = new BigNumber(await rewards.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION)
    ])
    this.mphBalance = new BigNumber(mphBalance).plus(stakedMPHBalance);
  }

  resetData(): void {
    this.mphBalance = new BigNumber(0);
  }

  connectWallet() {
    this.wallet.connect(() => { }, () => { }, false);
  }
}
