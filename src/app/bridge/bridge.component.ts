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

  anyswapInfo: any;
  fromChain: number;
  toChain: number;

  // bridge params
  bridgeFeeRate: BigNumber;
  bridgeMinimumFee: BigNumber;
  bridgeMaximumFee: BigNumber;

  bridgeMinimum: BigNumber;
  bridgeMaximum: BigNumber;
  bridgeThreshold: BigNumber;

  bridgeAddress: string;

  // converter params

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

  async loadData(loadUser: boolean, loadGlobal: boolean) {
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
      const apiStr = 'https://bridgeapi.anyswap.exchange/v2/serverInfo/chainid';
      const request = await fetch(apiStr);
      const result = await request.json();
      this.anyswapInfo = result;
      console.log(this.anyswapInfo);
      this.updateBridge();
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

      this.bridgeFeeRate = new BigNumber(0);
      this.bridgeMinimumFee = new BigNumber(0);
      this.bridgeMaximumFee = new BigNumber(0);

      this.bridgeMinimum = new BigNumber(0);
      this.bridgeMaximum = new BigNumber(0);
      this.bridgeThreshold = new BigNumber(0);

      this.bridgeAddress = '';
    }
  }

  updateBridge() {
    this.wallet.changeChain(this.fromChain);

    const anyswap = this.anyswapInfo[`${this.toChain}`].mphv5;

    this.bridgeFeeRate = new BigNumber(anyswap.SrcToken.SwapFeeRate);
    this.bridgeMinimum = new BigNumber(anyswap.SrcToken.MinimumSwap);
    this.bridgeMaximum = new BigNumber(anyswap.SrcToken.MaximumSwap);
    this.bridgeThreshold = new BigNumber(anyswap.SrcToken.BigValueThreshold);

    this.bridgeAddress = anyswap.SrcToken.DepositAddress;
    console.log(anyswap);
  }

  // this needs to be fixed.
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

  bridge() {
    // const web3 = new Web3(this.constants.RPC_WS[this.fromChain]);
    const web3 = this.wallet.readonlyWeb3();
    const mph = this.contract.getNamedContract(
      'MPHToken',
      web3,
      this.fromChain
    );
    const bridgeAmount = this.helpers.processWeb3Number(
      this.bridgeAmount.times(this.constants.PRECISION)
    );
    const func = mph.methods.transfer(this.bridgeAddress, bridgeAmount);

    console.log(func);

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  canBridge(): boolean {
    return (
      this.mphBalance.gte(this.bridgeAmount) &&
      this.bridgeAmount.gte(this.bridgeMinimum) &&
      this.bridgeAmount.lte(this.bridgeMaximum) &&
      this.wallet.networkID === this.fromChain &&
      this.fromChain !== this.toChain
    );
  }

  canContinue(): boolean {
    return true;
  }

  canConvert(): boolean {
    return true;
  }
}
