import { Component, OnInit, NgZone } from '@angular/core';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';
import BigNumber from 'bignumber.js';

@Component({
  selector: 'app-bridge',
  templateUrl: './bridge.component.html',
  styleUrls: ['./bridge.component.css'],
})
export class BridgeComponent implements OnInit {
  CHAINS: number[] = [
    this.constants.CHAIN_ID.MAINNET,
    // this.constants.CHAIN_ID.POLYGON,
    // this.constants.CHAIN_ID.AVALANCHE,
    this.constants.CHAIN_ID.FANTOM,
  ];

  // user variables
  mphBalance: BigNumber;
  bridgeAmount: BigNumber;
  fromChain: number;
  selectedFromChain: number;
  toChain: number;

  // bridge params
  anyswapInfo: any;
  estimatedFee: BigNumber;
  bridgeFeeRate: BigNumber;
  bridgeMinimumFee: BigNumber;
  bridgeMaximumFee: BigNumber;
  bridgeMinimum: BigNumber;
  bridgeMaximum: BigNumber;
  bridgeThreshold: BigNumber;
  bridgeAddress: string;

  // bridge status
  fromStatus: string;
  toStatus: string;
  bridgeHash: string;

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
        this.loadData(true, false);
      });
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      setTimeout(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      }, this.constants.TX_CONFIRMATION_REFRESH_WAIT_TIME);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const user = this.wallet.actualAddress.toLowerCase();
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const mph = this.contract.getNamedContract(
      'MPHToken',
      web3,
      this.wallet.networkID
    );

    if (loadUser && user) {
      if (mph.options.address) {
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
            this.estimateBridgeFee();
          });
      }
    }

    if (loadGlobal) {
      const apiStr = 'https://bridgeapi.anyswap.exchange/v2/serverInfo/chainid';
      const request = await fetch(apiStr);
      const result = await request.json();
      this.anyswapInfo = result;
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
      this.selectedFromChain = this.fromChain;
      this.toChain =
        this.wallet.networkID === this.constants.CHAIN_ID.MAINNET
          ? this.CHAINS.find((c) => c !== this.constants.CHAIN_ID.MAINNET)
          : this.constants.CHAIN_ID.MAINNET;

      // bridge status
      this.fromStatus = 'none';
      this.toStatus = 'none';
      this.bridgeHash = '';
    }
  }

  async updateChain(fromChain: boolean, toChain: boolean, chainId: string) {
    if (fromChain) {
      const changed = await this.wallet.changeChain(parseInt(chainId));

      if (changed) {
        this.fromChain = parseInt(chainId);
        this.toChain =
          this.fromChain === this.constants.CHAIN_ID.MAINNET
            ? this.CHAINS.find((c) => c !== this.constants.CHAIN_ID.MAINNET)
            : this.constants.CHAIN_ID.MAINNET;
        this.updateBridge();
      }
      this.selectedFromChain = this.fromChain;
    }

    if (toChain) {
      this.toChain = parseInt(chainId);
      this.updateBridge();
    }
  }

  updateBridge() {
    const anyswap =
      this.fromChain === this.constants.CHAIN_ID.MAINNET
        ? this.anyswapInfo[`${this.toChain}`].mphv5.SrcToken
        : this.anyswapInfo[`${this.fromChain}`].mphv5.DestToken;

    this.bridgeFeeRate = new BigNumber(anyswap.SwapFeeRate);
    this.bridgeMinimumFee = new BigNumber(anyswap.MinimumSwapFee);
    this.bridgeMaximumFee = new BigNumber(anyswap.MaximumSwapFee);

    this.bridgeMinimum = new BigNumber(anyswap.MinimumSwap);
    this.bridgeMaximum = new BigNumber(anyswap.MaximumSwap);
    this.bridgeThreshold = new BigNumber(anyswap.BigValueThreshold);

    this.bridgeAddress = anyswap.DcrmAddress;

    this.estimateBridgeFee();
  }

  async checkBridge(hash: string) {
    const apiStr = `https://bridgeapi.anyswap.exchange/v2/history/details?params=${hash}`;

    // check anyswap API for tx status every 10 seconds
    const status = setInterval(async () => {
      const request = await fetch(apiStr);
      const result = await request.json();
      if (result.msg === 'Success') {
        this.toStatus = 'success';
        clearInterval(status);
        this.wallet.changeChain(this.toChain).then(() => {
          // do nothing
        });
      }
    }, 10000);
  }

  setBridgeAmount(amount: string | number): void {
    let bridgeAmount = new BigNumber(amount);
    if (bridgeAmount.isNaN()) {
      bridgeAmount = new BigNumber(0);
    }
    this.bridgeAmount = bridgeAmount;
    this.estimateBridgeFee();
  }

  presetBridgeAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.bridgeAmount = this.mphBalance.times(ratio);
    this.estimateBridgeFee();
  }

  estimateBridgeFee(): void {
    const calculatedFee = this.bridgeAmount.times(this.bridgeFeeRate);
    this.estimatedFee = calculatedFee.lte(this.bridgeMinimumFee)
      ? this.bridgeMinimumFee
      : calculatedFee.gte(this.bridgeMaximumFee)
      ? this.bridgeMaximumFee
      : calculatedFee;
  }

  bridge() {
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

    this.wallet.sendTx(
      func,
      (hash) => {
        this.fromStatus = 'pending';
        this.bridgeHash = hash;
      },
      () => {},
      () => {
        this.fromStatus = 'success';
        this.toStatus = 'pending';
        this.checkBridge(this.bridgeHash);
      },
      (error) => {
        this.wallet.displayGenericError(error);
      },
      true
    );
  }
}

// TODO:
// Check that fromChain = networkID before allowing bridge transaction
// Double check that the bridge actually works
