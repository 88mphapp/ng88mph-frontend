import { Component, OnInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import BigNumber from 'bignumber.js';
import { AppComponent } from '../app.component';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { Watch } from '../watch';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  chainId: number;
  gasPrice: BigNumber;
  mphBalance: BigNumber;
  xMPHBalance: BigNumber;
  watchedModel = new Watch(false, '');

  constructor(
    public route: Router,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public app: AppComponent,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected, true);

    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData(true, true);
      this.loadData(true, true);
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    this.chainId = this.wallet.networkID;

    const readonlyWeb3 = this.wallet.readonlyWeb3();

    let address;
    if (this.wallet.connected && !this.wallet.watching) {
      address = this.wallet.userAddress;
    } else if (this.wallet.watching) {
      address = this.wallet.watchedAddress;
    }

    if (loadUser) {
      const mph = await this.contract.getContract(
        this.constants.MPH_ADDRESS[this.chainId],
        `${this.constants.CHAIN_NAME[this.chainId]}/MPHToken`
      );
      mph.methods
        .balanceOf(address)
        .call()
        .then((mphBalance) => {
          this.mphBalance = new BigNumber(mphBalance).div(
            this.constants.PRECISION
          );
        });

      const xmph = await this.contract.getContract(
        this.constants.XMPH_ADDRESS[this.chainId],
        `${this.constants.CHAIN_NAME[this.chainId]}/xMPHToken`
      );
      xmph.methods
        .balanceOf(address)
        .call()
        .then((xMPHBalance) => {
          this.xMPHBalance = new BigNumber(xMPHBalance).div(
            this.constants.PRECISION
          );
        });
    }

    if (loadGlobal) {
      this.gasPrice = new BigNumber(await readonlyWeb3.eth.getGasPrice()).div(
        1e9
      );
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.mphBalance = new BigNumber(0);
      this.xMPHBalance = new BigNumber(0);
    }

    if (resetGlobal) {
      this.chainId = 0;
      this.gasPrice = new BigNumber(0);
    }
  }

  connectWallet() {
    this.wallet.connect(
      () => {},
      () => {},
      false
    );
  }

  onSubmit() {
    this.wallet.watchWallet(this.watchedModel.address);
    this.loadData(true, true);
  }

  switchFocus(watching: boolean) {
    this.wallet.watch.watching = watching;
    this.loadData(true, true);
  }
}
