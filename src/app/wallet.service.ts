import { Injectable, Inject, EventEmitter } from '@angular/core';
import { Web3Enabled } from './web3Enabled';
import Web3 from 'web3';
import { WEB3 } from './web3';
import { isNullOrUndefined } from 'util';
import { Watch } from './watch';
import { ConstantsService } from './constants.service';

@Injectable({
  providedIn: 'root',
})
export class WalletService extends Web3Enabled {
  watch: Watch;

  constructor(@Inject(WEB3) public web3: Web3, constants: ConstantsService) {
    super(web3, constants);
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

  watchWallet(address: string) {
    this.watch.watching = true;
    this.watch.address = address;
  }
}
