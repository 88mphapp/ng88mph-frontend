import { Injectable, Inject, EventEmitter } from '@angular/core';
import { Web3Enabled } from './web3Enabled';
import Web3 from 'web3';
import { WEB3 } from './web3';
import { isNullOrUndefined } from 'util';
import { Watch } from './watch';
import { ConstantsService } from './constants.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Injectable({
  providedIn: 'root',
})
export class WalletService extends Web3Enabled {
  watch: Watch;

  constructor(
    @Inject(WEB3) public web3: Web3,
    constants: ConstantsService,
    modalService: NgbModal
  ) {
    super(web3, constants, modalService);
    this.watch = new Watch(false, null);
  }

  public get userAddress(): string {
    return this.state.address;
  }

  public get connected(): boolean {
    return !!this.state.address;
  }

  public get watchedAddress(): string {
    return this.watch.address;
  }

  public get watching(): boolean {
    return this.watch.watching;
  }

  public get actualAddress(): string {
    if (this.connected && !this.watching) {
      return this.userAddress;
    } else if (this.watching) {
      return this.watchedAddress;
    } else {
      return '';
    }
  }

  watchWallet(address: string) {
    this.watch.watching = true;
    this.watch.address = address;
  }
}
