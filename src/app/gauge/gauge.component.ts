import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ModalUnstakeComponent } from './modal-unstake/modal-unstake.component';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { DataService } from '../data.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-gauge',
  templateUrl: './gauge.component.html',
  styleUrls: ['./gauge.component.css'],
})
export class GaugeComponent implements OnInit {
  // user variables
  mphLocked: BigNumber;
  mphBalance: BigNumber;
  mphUnlocked: BigNumber;
  veBalance: BigNumber;
  lockEnd: number;

  // global variables

  constructor(
    public constants: ConstantsService,
    public contract: ContractService,
    public datas: DataService,
    public wallet: WalletService,
    private modalService: NgbModal,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected || this.wallet.watching, true);

    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(false, false);
    });

    // this.wallet.chainChangedEvent.subscribe((networkID) => {
    //   this.zone.run(() => {
    //     this.resetData(true, true);
    //     this.loadData(true, true);
    //   });
    // });

    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });

    this.wallet.txConfirmedEvent.subscribe(() => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      });
    });
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.mphLocked = new BigNumber(0);
      this.mphBalance = new BigNumber(0);
      this.mphUnlocked = new BigNumber(0);
      this.veBalance = new BigNumber(0);
      this.lockEnd = 0;
    }

    if (resetGlobal) {
    }
  }

  loadData(loadUser: boolean, loadGlobal: boolean): void {
    const web3 = this.wallet.httpsWeb3(this.wallet.networkID);
    const mph = this.contract.getNamedContract('MPHToken', web3);
    const vemph = this.contract.getNamedContract('veMPH', web3); // @dev currently using address for veCRV during development
    const address = this.wallet.actualAddress.toLowerCase();

    if (loadUser && address) {
      // load user MPH balance
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

      if (vemph.options.address) {
        // load user's current voting power
        vemph.methods
          .balanceOf(address)
          .call()
          .then((balance) => {
            this.veBalance = new BigNumber(balance).div(
              this.constants.PRECISION
            );
          });

        // load user's current lock
        // @dev needs to be checked against expired lock
        vemph.methods
          .locked(address)
          .call()
          .then((result) => {
            const now = Math.floor(Date.now() / 1e3);
            const amount = new BigNumber(result.amount).div(
              this.constants.PRECISION
            );
            this.lockEnd = parseInt(result.end);
            this.lockEnd > now
              ? (this.mphLocked = amount)
              : (this.mphUnlocked = amount);
          });
      }
    }

    if (loadGlobal) {
      console.log('load global');
    }
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleString();
  }

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeComponent, {
      windowClass: 'fullscreen',
    });
  }
}
