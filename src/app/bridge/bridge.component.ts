import { Component, OnInit, NgZone } from '@angular/core';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';
import BigNumber from 'bignumber.js';
import Web3 from 'web3';

@Component({
  selector: 'app-bridge',
  templateUrl: './bridge.component.html',
  styleUrls: ['./bridge.component.css'],
})
export class BridgeComponent implements OnInit {
  mphBalance: BigNumber;
  bridgeAmount: BigNumber;

  fromChain: number;
  toChain: number;

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      });
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });
  }

  loadData(loadUser: boolean, loadGlobal: boolean) {
    const user = this.wallet.actualAddress.toLowerCase();
    const web3 = new Web3(this.constants.RPC[this.fromChain]);
    const mph = this.contract.getNamedContract(
      'MPHToken',
      web3,
      this.fromChain
    );

    if (loadUser && user) {
      mph.methods
        .balanceOf(user)
        .call()
        .then((balance) => {
          this.mphBalance = new BigNumber(balance).div(
            this.constants.PRECISION
          );
          this.bridgeAmount = new BigNumber(balance).div(
            this.constants.PRECISION
          );
        });
    }

    if (loadGlobal) {
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.mphBalance = new BigNumber(0);
      this.bridgeAmount = new BigNumber(0);
    }

    if (resetGlobal) {
      this.fromChain = this.wallet.networkID;
      this.toChain =
        this.wallet.networkID === this.constants.CHAIN_ID.MAINNET
          ? this.constants.CHAIN_ID.FANTOM
          : this.constants.CHAIN_ID.MAINNET;
    }
  }

  setBridgeAmount(amount: string | number): void {
    let bridgeAmount = new BigNumber(amount);
    if (bridgeAmount.isNaN()) {
      bridgeAmount = new BigNumber(0);
    }
    this.bridgeAmount = bridgeAmount;
  }

  presetBridgeAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.bridgeAmount = this.mphBalance.times(ratio);
  }

  canContinue(): boolean {
    return (
      this.mphBalance.gte(this.bridgeAmount) &&
      this.wallet.networkID === this.fromChain &&
      this.fromChain !== this.toChain
    );
  }
}
