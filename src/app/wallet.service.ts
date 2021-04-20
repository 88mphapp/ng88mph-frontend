import { Injectable, Inject, EventEmitter } from '@angular/core';
import { Web3Enabled } from './web3Enabled';
import Web3 from 'web3';
import { WEB3 } from './web3';
import { isNullOrUndefined } from 'util';
import { Watch } from './watch';

@Injectable({
  providedIn: 'root'
})
export class WalletService extends Web3Enabled {
  connectedEvent: EventEmitter<null>;
  disconnectedEvent: EventEmitter<null>;
  watch: Watch;

  constructor(@Inject(WEB3) public web3: Web3) {
    super(web3);
    this.connectedEvent = new EventEmitter<null>();
    this.disconnectedEvent = new EventEmitter<null>();
    this.watch = new Watch(false, null);
  }

  public get userAddress(): string {
    return this.state.address;
  }

  public get connected(): boolean {
    return !isNullOrUndefined(this.state.address);
  }

  public get watchedAddress(): string {
    return this.watch.address;
  }

  public get watching(): boolean {
    return this.watch.watching;
  }

  async connect(onConnected, onError, isStartupMode: boolean) {
    const _onConnected = () => {
      this.connectedEvent.emit();
      onConnected();
    };
    const _onError = () => {
      this.disconnectedEvent.emit();
      onError();
    }
    await super.connect(_onConnected, _onError, isStartupMode);
  }

  watchWallet(address: string) {
    this.watch.watching = true;
    this.watch.address = address;
  }

}
