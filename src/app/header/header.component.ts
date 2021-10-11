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
import { request, gql } from 'graphql-request';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  gasPrice: BigNumber;
  gasInterval: any;
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
    const address = this.wallet.actualAddress.toLowerCase();
    const readonlyWeb3 = this.wallet.readonlyWeb3(this.wallet.networkID);

    if (
      loadUser &&
      address &&
      (this.wallet.networkID === this.constants.CHAIN_ID.MAINNET ||
        this.wallet.networkID === this.constants.CHAIN_ID.RINKEBY)
    ) {
      const queryString = gql`
        {
          mphholder (
            id: "${address}"
          ) {
            mphBalance
            xmphBalance
          }
        }
      `;
      request(
        this.constants.MPH_TOKEN_GRAPHQL_ENDPOINT[this.wallet.networkID],
        queryString
      ).then((data: QueryResult) => {
        this.mphBalance = new BigNumber(data.mphholder.mphBalance);
        this.xMPHBalance = new BigNumber(data.mphholder.xmphBalance);
      });
    }

    if (loadGlobal) {
      setTimeout(async () => {
        this.gasPrice = new BigNumber(await readonlyWeb3.eth.getGasPrice()).div(
          1e9
        );
        clearInterval(this.gasInterval);
        this.gasInterval = setInterval(async () => {
          this.gasPrice = new BigNumber(
            await readonlyWeb3.eth.getGasPrice()
          ).div(1e9);
        }, 5000);
      }, 3000);
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

interface QueryResult {
  mphholder: {
    mphBalance: string;
    xmphBalance: string;
  };
}
