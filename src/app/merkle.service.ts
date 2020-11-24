import { Injectable } from '@angular/core';
import Web3 from 'web3';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root'
})
export class MerkleService {
  ETH_MERKLE_DISTRIBUTOR = '0x4b36027316dDC9bEE9a1Ae8EaF0e34d1F9B1814B';
  MPH_MERKLE_DISTRIBUTOR = '0x8c5ddBB0fd86B6480D81A1a5872a63812099C043';

  constructor(public wallet: WalletService) { }

  getETHClaimForAddress(address: string) {
    const merkleTree = require('src/assets/json/eth-snapshot-merkle-tree.json') as MerkleDistributorInfo;
    const checksumAddress = this.wallet.readonlyWeb3().utils.toChecksumAddress(address);
    const claim = merkleTree.claims[checksumAddress];
    return claim;
  }

  getMPHClaimForAddress(address: string) {
    const merkleTree = require('src/assets/json/mph-snapshot-merkle-tree.json') as MerkleDistributorInfo;
    const checksumAddress = this.wallet.readonlyWeb3().utils.toChecksumAddress(address);
    const claim = merkleTree.claims[checksumAddress];
    return claim;
  }

  getETHMerkleDistributor(web3?: Web3) {
    const abi = require(`../assets/abis/MerkleDistributor.json`);
    const address = this.ETH_MERKLE_DISTRIBUTOR;
    if (web3) {
      return new web3.eth.Contract(abi, address);
    }
    return new this.wallet.web3.eth.Contract(abi, address);
  }

  getMPHMerkleDistributor(web3?: Web3) {
    const abi = require(`../assets/abis/MerkleDistributor.json`);
    const address = this.MPH_MERKLE_DISTRIBUTOR;
    if (web3) {
      return new web3.eth.Contract(abi, address);
    }
    return new this.wallet.web3.eth.Contract(abi, address);
  }
}

interface MerkleDistributorInfo {
  merkleRoot: string
  tokenTotal: string
  claims: {
    [account: string]: {
      index: number
      amount: string
      proof: string[]
      flags?: {
        [flag: string]: boolean
      }
    }
  }
}