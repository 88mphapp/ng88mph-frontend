import { Injectable } from '@angular/core';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root'
})
export class ContractService {

  constructor(public wallet: WalletService) { }

  getPoolAddress(name: string): string {
    return require('../assets/json/pools.json')[name].address;
  }

  getPoolStablecoinAddress(name: string): string {
    return require('../assets/json/pools.json')[name].stablecoin;
  }

  getPool(name: string) {
    const abi = require(`../assets/abis/DInterest.json`);
    const address = this.getPoolAddress(name);
    return new this.wallet.web3.eth.Contract(abi, address);
  }

  getPoolStablecoin(name: string) {
    const abi = require(`../assets/abis/DInterest.json`);
    const address = this.getPoolStablecoinAddress(name);
    return new this.wallet.web3.eth.Contract(abi, address);
  }
}
