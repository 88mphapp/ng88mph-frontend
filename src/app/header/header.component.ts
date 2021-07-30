import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import BigNumber from 'bignumber.js';
import { AppComponent } from '../app.component';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { Watch } from '../watch';
import { TermsOfServiceComponent } from '../terms-of-service/terms-of-service.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  gasPrice: BigNumber;
  mphBalance: BigNumber;
  xMPHBalance: BigNumber;
  acceptedTerms: boolean;
  watchedModel = new Watch(false, '');

  constructor(
    private modalService: NgbModal,
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
      this.loadData(false, true);
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
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();

    let address = this.wallet.actualAddress;

    if (loadUser && address) {
      const mph = await this.contract.getContract(
        this.constants.MPH_ADDRESS[this.wallet.networkID],
        `MPHToken`
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
        this.constants.XMPH_ADDRESS[this.wallet.networkID],
        `xMPH`
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
      this.gasPrice = new BigNumber(0);
      this.acceptedTerms = false;
    }
  }

  connectWallet() {
    if (!this.wallet.connected && !this.acceptedTerms) {
      this.openTermsOfServiceModal();
    } else {
      this.wallet.connect(
        () => {},
        () => {},
        false
      );
    }
  }

  onSubmit() {
    this.wallet.watchWallet(this.watchedModel.address);
    this.wallet.accountChangedEvent.emit(this.wallet.watch.address);
  }

  switchFocus(watching: boolean) {
    this.wallet.watch.watching = watching;
    this.wallet.accountChangedEvent.emit(
      watching ? this.wallet.watch.address : this.wallet.userAddress
    );
  }

  openTermsOfServiceModal() {
    const modalRef = this.modalService.open(TermsOfServiceComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.result.then((event) => {
      this.acceptedTerms = event;
      if (event) {
        this.wallet.connect(
          () => {},
          () => {},
          false
        );
      }
    });
  }
}
