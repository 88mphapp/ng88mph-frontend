import { Injectable } from '@angular/core';
import Web3 from 'web3';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root',
})
export class ContractService {
  constructor(public wallet: WalletService) {}

  getContract(address: string, abiName: string, web3?: Web3) {
    const abi = require(`../assets/abis/${abiName}.json`);
    if (web3) {
      return new web3.eth.Contract(abi, address);
    }
    return new this.wallet.web3.eth.Contract(abi, address);
  }

  getPoolAddress(name: string): string {
    return require('../assets/json/pools.json')[this.wallet.networkID][name]
      .address;
  }

  getPoolStablecoinAddress(name: string): string {
    return require('../assets/json/pools.json')[this.wallet.networkID][name]
      .stablecoin;
  }

  getPoolInfo(name: string): PoolInfo {
    return require('../assets/json/pools.json')[this.wallet.networkID][name];
  }

  getPoolInfoList(): PoolInfo[] {
    return Object.keys(
      require('../assets/json/pools.json')[this.wallet.networkID]
    ).map((pool) => this.getPoolInfo(pool));
  }

  getPoolInfoFromAddress(address: string): PoolInfo {
    return this.getPoolInfoList().find(
      (poolInfo) => poolInfo.address.toLowerCase() === address.toLowerCase()
    );
  }

  getPool(name: string, web3?: Web3) {
    const address = this.getPoolAddress(name);
    return this.getContract(address, 'DInterest', web3);
  }

  getPoolStablecoin(name: string, web3?: Web3) {
    const address = this.getPoolStablecoinAddress(name);
    return this.getContract(address, 'ERC20', web3);
  }

  getNamedContract(name: string, web3?: Web3, networkID?: number) {
    const actualNetworkID = (
      networkID ? networkID : this.wallet.networkID
    ).toString();
    const address = require('../assets/json/contracts.json')[actualNetworkID][
      name
    ];
    return this.getContract(address, name, web3);
  }

  getNamedContractAddress(name: string, networkID?: number) {
    const actualNetworkID = (
      networkID ? networkID : this.wallet.networkID
    ).toString();
    return require('../assets/json/contracts.json')[actualNetworkID][name];
  }

  getERC20(address: string, web3?: Web3) {
    return this.getContract(address, 'ERC20', web3);
  }

  getRewards(address: string, web3?: Web3) {
    return this.getContract(address, 'Rewards', web3);
  }

  getZapDepositTokenAddress(symbol: string): string {
    return require('../assets/json/zap-deposit-tokens.json')[symbol];
  }

  getZeroCouponBondPoolNameList(): string[] {
    return Object.keys(
      require('../assets/json/zero-coupon-bonds.json')[this.wallet.networkID]
    );
  }

  getZeroCouponBondPool(name: string): ZeroCouponBondInfo[] {
    return require('../assets/json/zero-coupon-bonds.json')[
      this.wallet.networkID
    ][name];
  }

  getZeroCouponBondContract(address: string, web3?: Web3) {
    return this.getContract(address, 'ZeroCouponBond', web3);
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
  moneyMarket: string;
  stakingPool?: string;
  curveSwapAddress?: string;
  zapDepositTokens?: string[];
  interestFee?: number;
  depositFee?: number;
}

export interface ZeroCouponBondInfo {
  series: string;
  symbol: string;
  address: string;
  maturationTimestamp: number;
  sushiSwapPair?: string;
  sushiSwapPairBaseTokenSymbol?: string;
  sushiSwapPairBaseTokenAddress?: string;
  farmAddress?: string;
}
