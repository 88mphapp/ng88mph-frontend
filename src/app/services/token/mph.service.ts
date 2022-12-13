import { Injectable } from '@angular/core';
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from 'ethereum-multicall';
import BigNumber from 'bignumber.js';

import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Injectable({
  providedIn: 'root',
})
export class MphService {
  price: BigNumber = new BigNumber(0);
  totalSupply: BigNumber = new BigNumber(0);
  circulatingSupply: BigNumber = new BigNumber(0);

  constructor(
    public constants: ConstantsService,
    public helpers: HelpersService,
    public wallet: WalletService
  ) {
    this.loadData();
  }

  loadData() {
    Promise.all([
      this.fetchPrice(),
      this.fetchSupply(this.constants.CHAIN_ID.MAINNET),
    ]).then(() => {});
  }

  async fetchPrice() {
    this.price = await this.helpers.getMPHPriceUSD();
  }

  async fetchSupply(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const multicall = new Multicall({ web3Instance: web3, tryAggregate: true });

    const context: ContractCallContext[] = [
      {
        reference: 'MPH',
        contractAddress: this.constants.MPH_ADDRESS[networkID],
        abi: require(`src/assets/abis/MPHToken.json`),
        calls: [
          {
            reference: 'Total Supply',
            methodName: 'totalSupply',
            methodParameters: [],
          },
          {
            reference: 'Gov Treasury Balance',
            methodName: 'balanceOf',
            methodParameters: [this.constants.GOV_TREASURY[networkID]],
          },
          {
            reference: 'Dev Wallet Balance',
            methodName: 'balanceOf',
            methodParameters: [this.constants.DEV_WALLET[networkID]],
          },
          {
            reference: 'Merkle Distributor',
            methodName: 'balanceOf',
            methodParameters: [this.constants.MERKLE_DISTRIBUTOR[networkID]],
          },
        ],
      },
    ];

    const results: ContractCallResults = await multicall.call(context);
    const data = results.results.MPH.callsReturnContext;

    const totalSupply = new BigNumber(data[0].returnValues[0].hex).div(1e18);
    const govTreasuryBalance = new BigNumber(data[1].returnValues[0].hex).div(
      1e18
    );
    const devWalletBalance = new BigNumber(data[2].returnValues[0].hex).div(
      1e18
    );
    const merkleDistributorBalance = new BigNumber(
      data[3].returnValues[0].hex
    ).div(1e18);

    this.totalSupply = totalSupply;
    this.circulatingSupply = totalSupply
      .minus(govTreasuryBalance)
      .minus(devWalletBalance)
      .minus(merkleDistributorBalance);
  }
}
