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
  gasInterval: any;
  mphBalance: BigNumber;
  convertableBalance: BigNumber;
  xMPHBalance: BigNumber;
  veMPHBalance: BigNumber;
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
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(false, false);
    });

    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        clearInterval(this.gasInterval);
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
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const address = this.wallet.actualAddress.toLowerCase();

    if (loadUser && address) {
      const mph = this.contract.getNamedContract('MPHToken', web3);
      const xmph = this.contract.getNamedContract('xMPH', web3);
      const vemph = this.contract.getNamedContract('veMPH', web3);
      const convertableMPH = this.contract.getContract(
        this.constants.FOREIGN_MPH_ADDRESS[this.wallet.networkID],
        'ERC20',
        web3
      );
      if (mph.options.address) {
        mph.methods
          .balanceOf(address)
          .call()
          .then((balance) => {
            this.mphBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });
      }
      if (xmph.options.address) {
        xmph.methods
          .balanceOf(address)
          .call()
          .then((balance) => {
            this.xMPHBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });
      }
      if (vemph.options.address) {
        vemph.methods
          .balanceOf(address)
          .call()
          .then((balance) => {
            this.veMPHBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });
      }

      if (convertableMPH.options.address) {
        convertableMPH.methods
          .balanceOf(address)
          .call()
          .then((balance) => {
            this.convertableBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });
      }
    }

    if (loadGlobal) {
      setTimeout(async () => {
        this.gasPrice = new BigNumber(await web3.eth.getGasPrice()).div(1e9);
        clearInterval(this.gasInterval);
        this.gasInterval = setInterval(async () => {
          this.gasPrice = new BigNumber(await web3.eth.getGasPrice()).div(1e9);
        }, 5000);
      }, 3000);
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.mphBalance = new BigNumber(0);
      this.convertableBalance = new BigNumber(0);
      this.xMPHBalance = new BigNumber(0);
      this.veMPHBalance = new BigNumber(0);
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
