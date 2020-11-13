import { Injectable } from '@angular/core';
import Web3 from 'web3';
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

  getPoolInfo(name: string): PoolInfo {
    return require('../assets/json/pools.json')[name];
  }

  getPoolInfoList(): PoolInfo[] {
    return Object.keys(require('../assets/json/pools.json'))
      .map(pool => this.getPoolInfo(pool));
  }

  getPoolInfoFromAddress(address: string): PoolInfo {
    return this.getPoolInfoList()
      .find(poolInfo => poolInfo.address.toLowerCase() === address.toLowerCase());
  }

  getPool(name: string, web3?: Web3) {
    const abi = require(`../assets/abis/DInterest.json`);
    const address = this.getPoolAddress(name);
    if (web3) {
      return new web3.eth.Contract(abi, address);
    }
    return new this.wallet.web3.eth.Contract(abi, address);
  }

  getPoolStablecoin(name: string, web3?: Web3) {
    const abi = require(`../assets/abis/ERC20.json`);
    const address = this.getPoolStablecoinAddress(name);
    if (web3) {
      return new web3.eth.Contract(abi, address);
    }
    return new this.wallet.web3.eth.Contract(abi, address);
  }

  getNamedContract(name: string, web3?: Web3) {
    const abi = require(`../assets/abis/${name}.json`);
    const address = require('../assets/json/contracts.json')[name];
    if (web3) {
      return new web3.eth.Contract(abi, address);
    }
    return new this.wallet.web3.eth.Contract(abi, address);
  }

  getERC20(address: string, web3?: Web3) {
    const abi = require(`../assets/abis/ERC20.json`);
    if (web3) {
      return new web3.eth.Contract(abi, address);
    }
    return new this.wallet.web3.eth.Contract(abi, address);
  }
}

export interface PoolInfo {
  name: string;
  address: string;
  stablecoin: string;
  stablecoinSymbol: string;
  stablecoinDecimals: number;
  protocol: string;
  iconPath: string;
}