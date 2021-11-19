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
  foreignBalance: BigNumber;
  foreignAllowance: BigNumber;
  bridgeAmount: BigNumber;
  convertAmount: BigNumber;

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
        this.loadData(true, true);
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
    const web3 = new Web3(this.constants.RPC[this.wallet.networkID]);
    const nativeMPH = this.contract.getNamedContract(
      'MPHToken',
      web3,
      this.wallet.networkID
    );
    const foreignMPH = this.contract.getContract(
      this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID],
      'ERC20',
      web3
    );

    if (loadUser && user) {
      nativeMPH.methods
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

      if (foreignMPH.options.address) {
        await foreignMPH.methods
          .balanceOf(user)
          .call()
          .then((balance) => {
            this.foreignBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
            this.convertAmount = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });

        foreignMPH.methods
          .allowance(user, this.constants.MPH_CONVERTER[this.wallet.networkID])
          .call()
          .then((allowance) => {
            this.foreignAllowance = new BigNumber(allowance).div(
              this.constants.PRECISION
            );
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
      this.foreignBalance = new BigNumber(0);
      this.foreignAllowance = new BigNumber(0);
      this.bridgeAmount = new BigNumber(0);
      this.convertAmount = new BigNumber(0);
    }

    if (resetGlobal) {
      this.fromChain = this.wallet.networkID;
      this.toChain =
        this.wallet.networkID === this.constants.CHAIN_ID.MAINNET
          ? this.constants.CHAIN_ID.FANTOM
          : this.constants.CHAIN_ID.MAINNET;

      // bridge params
      this.bridgeFeeRate = new BigNumber(0);
      this.bridgeMinimumFee = new BigNumber(0);
      this.bridgeMaximumFee = new BigNumber(0);

      this.bridgeMinimum = new BigNumber(0);
      this.bridgeMaximum = new BigNumber(0);
      this.bridgeThreshold = new BigNumber(0);

      this.bridgeAddress = '';

      // bridge status
      this.fromStatus = 'none';
      this.toStatus = 'none';
      this.bridgeHash = '';
    }
  }

  updateBridge() {
    this.wallet.changeChain(this.fromChain).then(() => {
      // do nothing
    });

    const anyswap = this.anyswapInfo[`${this.toChain}`].mphv5;

    this.bridgeFeeRate = new BigNumber(anyswap.SrcToken.SwapFeeRate);
    this.bridgeMinimum = new BigNumber(anyswap.SrcToken.MinimumSwap);
    this.bridgeMaximum = new BigNumber(anyswap.SrcToken.MaximumSwap);
    this.bridgeThreshold = new BigNumber(anyswap.SrcToken.BigValueThreshold);

    this.bridgeAddress = anyswap.SrcToken.DepositAddress;
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
  }

  presetBridgeAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.bridgeAmount = this.mphBalance.times(ratio);
  }

  setConvertAmount(amount: string | number): void {
    let convertAmount = new BigNumber(amount);
    if (convertAmount.isNaN()) {
      convertAmount = new BigNumber(0);
    }
    this.convertAmount = convertAmount;
  }

  presetConvertAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.convertAmount = this.foreignBalance.times(ratio);
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

  approveConverter() {
    const web3 = this.wallet.readonlyWeb3();
    const user = this.wallet.actualAddress.toLowerCase();
    const converter = this.constants.MPH_CONVERTER[this.wallet.networkID];
    const foreignMPH = this.contract.getContract(
      this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID],
      'ERC20',
      web3
    );
    const approveAmount = this.helpers.processWeb3Number(
      this.foreignBalance.times(this.constants.PRECISION)
    );

    this.wallet.approveToken(
      foreignMPH,
      converter,
      approveAmount,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  convert() {
    const web3 = this.wallet.readonlyWeb3();
    const converter = this.contract.getNamedContract(
      'MPHConverter',
      web3,
      this.wallet.networkID
    );
    const foreignMPH =
      this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID];
    const convertAmount = this.helpers.processWeb3Number(
      this.convertAmount.times(this.constants.PRECISION)
    );
    const func = converter.methods.convertForeignTokenToNative(
      foreignMPH,
      convertAmount
    );

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

  // unconvert() {
  //   const web3 = this.wallet.readonlyWeb3();
  //   const converter = this.contract.getNamedContract('MPHConverter', web3, this.wallet.networkID);
  //
  //   const foreignMPH = this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID];
  //
  //   const convertAmount = this.helpers.processWeb3Number(
  //     new BigNumber(1.25).times(this.constants.PRECISION)
  //   );
  //
  //   const func = converter.methods.convertNativeTokenToForeign(foreignMPH, convertAmount);
  //
  //   console.log(func);
  //
  //   this.wallet.sendTx(
  //     func,
  //     () => {},
  //     () => {},
  //     () => {},
  //     (error) => {
  //       this.wallet.displayGenericError(error);
  //     }
  //   );
  // }

  canBridge(): boolean {
    return (
      this.mphBalance.gte(this.bridgeAmount) &&
      this.bridgeAmount.gte(this.bridgeMinimum) &&
      this.bridgeAmount.lte(this.bridgeMaximum) &&
      this.wallet.networkID === this.fromChain &&
      this.fromChain !== this.toChain &&
      this.fromChain === this.constants.CHAIN_ID.MAINNET
    );
  }

  canConvert(): boolean {
    return (
      this.convertAmount.gt(0) && this.foreignAllowance.gte(this.convertAmount)
    );
  }
}
