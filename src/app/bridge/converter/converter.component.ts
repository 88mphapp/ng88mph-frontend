import { Component, OnInit, NgZone } from '@angular/core';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import BigNumber from 'bignumber.js';

@Component({
  selector: 'app-converter',
  templateUrl: './converter.component.html',
  styleUrls: ['./converter.component.css'],
})
export class ConverterComponent implements OnInit {
  convertableBalance: BigNumber;
  approvedAmount: BigNumber;
  convertAmount: BigNumber;

  constructor(
    public constants: ConstantsService,
    public contract: ContractService,
    public helpers: HelpersService,
    public wallet: WalletService,
    private zone: NgZone
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData();
        this.loadData();
      });
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData();
        this.loadData();
      });
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      setTimeout(() => {
        this.resetData();
        this.loadData();
      }, this.constants.TX_CONFIRMATION_REFRESH_WAIT_TIME);
    });
  }

  resetData(): void {
    this.convertableBalance = new BigNumber(0);
    this.approvedAmount = new BigNumber(0);
    this.convertAmount = new BigNumber(0);
  }

  loadData(): void {
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const user = this.wallet.actualAddress.toLowerCase();
    if (!user) return;

    if (!this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID]) return;
    const convertableMPH = this.contract.getContract(
      this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID],
      'ERC20',
      web3
    );

    convertableMPH.methods
      .balanceOf(user)
      .call()
      .then((result) => {
        const balance = new BigNumber(result);
        this.convertableBalance = balance.div(this.constants.PRECISION);
        this.convertAmount = balance.div(this.constants.PRECISION);
      });
    convertableMPH.methods
      .allowance(user, this.constants.MPH_CONVERTER[this.wallet.networkID])
      .call()
      .then((result) => {
        const allowance = new BigNumber(result);
        this.approvedAmount = allowance.div(this.constants.PRECISION);
      });
  }

  setConvertAmount(amount: string | number | BigNumber): void {
    let convertAmount = new BigNumber(amount);
    if (convertAmount.isNaN()) {
      convertAmount = new BigNumber(0);
    }
    this.convertAmount = convertAmount;
  }

  approveConverter(): void {
    const web3 = this.wallet.readonlyWeb3();
    const user = this.wallet.actualAddress.toLowerCase();
    const converter = this.constants.MPH_CONVERTER[this.wallet.networkID];
    const convertableMPH = this.contract.getContract(
      this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID],
      'ERC20',
      web3
    );
    const approveAmount = this.helpers.processWeb3Number(
      this.convertAmount.times(this.constants.PRECISION)
    );

    this.wallet.approveToken(
      convertableMPH,
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

  convert(): void {
    const web3 = this.wallet.readonlyWeb3();
    const converter = this.contract.getNamedContract(
      'MPHConverter',
      web3,
      this.wallet.networkID
    );
    const mph = this.constants.MPH_ADDRESS[this.wallet.networkID];
    const convertAmount = this.helpers.processWeb3Number(
      this.convertAmount.times(this.constants.PRECISION)
    );
    const func = converter.methods.convertNativeTokenToForeign(
      mph,
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
}
