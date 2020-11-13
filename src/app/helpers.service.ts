import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import CoinGecko from 'coingecko-api';
import { ConstantsService } from './constants.service';
import { ContractService } from './contract.service';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root'
})
export class HelpersService {
  private coinGeckoClient: CoinGecko;

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService
  ) {
    this.coinGeckoClient = new CoinGecko();
  }

  async getTokenPriceUSD(address: string): Promise<number> {
    const rawData = await this.coinGeckoClient.coins.fetchCoinContractMarketChart(address, 'ethereum', {
      days: 0
    });
    if (rawData.success) {
      return rawData.data.prices[0][1];
    } else {
      return 0;
    }
  }

  processWeb3Number(number): string {
    return new BigNumber(number).integerValue().toFixed();
  }

  async getMPHPriceUSD(): Promise<BigNumber> {
    const infuraEndpoint = this.wallet.infuraEndpoint();
    const uniswapPair = this.contract.getNamedContract('MPHLP', infuraEndpoint);
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const mphReserve = new BigNumber(reservesObj._reserve0).div(this.constants.PRECISION);
    const ethReserve = new BigNumber(reservesObj._reserve1).div(this.constants.PRECISION);
    const priceInETH = ethReserve.div(mphReserve);
    const ethPriceInUSD = await this.getTokenPriceUSD(this.constants.WETH_ADDR);
    return priceInETH.times(ethPriceInUSD);
  }

  async getMPHLPPriceUSD(): Promise<BigNumber> {
    const infuraEndpoint = this.wallet.infuraEndpoint();
    const uniswapPair = this.contract.getNamedContract('MPHLP', infuraEndpoint);
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const ethReserve = new BigNumber(reservesObj._reserve1).div(this.constants.PRECISION);
    const ethPriceInUSD = await this.getTokenPriceUSD(this.constants.WETH_ADDR);
    const lpTotalSupply = new BigNumber(await uniswapPair.methods.totalSupply().call()).div(this.constants.PRECISION);
    return lpTotalSupply.isZero() ? new BigNumber(0) : ethReserve.times(ethPriceInUSD).times(2).div(lpTotalSupply);
  }
}
