import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { ConstantsService } from './constants.service';
import { ContractService } from './contract.service';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root'
})
export class HelpersService {

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService
  ) {
  }

  async getTokenPriceUSD(address: string): Promise<number> {
    const apiStr = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}/market_chart/?vs_currency=usd&days=0`;
    const rawResult = await this.httpsGet(apiStr, 300);
    return rawResult.prices[0][1];
  }

  processWeb3Number(number): string {
    return new BigNumber(number).integerValue().toFixed();
  }

  async httpsGet(apiStr, cacheMaxAge: number = 60) {
    const request = await fetch(apiStr, { headers: { 'Cache-Control': `max-age=${cacheMaxAge}` } });
    return await request.json();
  }

  async getMPHPriceUSD(): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const uniswapPair = this.contract.getNamedContract('MPHLP', readonlyWeb3);
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const mphReserve = new BigNumber(reservesObj._reserve0).div(this.constants.PRECISION);
    const ethReserve = new BigNumber(reservesObj._reserve1).div(this.constants.PRECISION);
    const priceInETH = ethReserve.div(mphReserve);
    const ethPriceInUSD = await this.getTokenPriceUSD(this.constants.WETH_ADDR);
    return priceInETH.times(ethPriceInUSD);
  }

  async getMPHLPPriceUSD(): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const uniswapPair = this.contract.getNamedContract('MPHLP', readonlyWeb3);
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const ethReserve = new BigNumber(reservesObj._reserve1).div(this.constants.PRECISION);
    const ethPriceInUSD = await this.getTokenPriceUSD(this.constants.WETH_ADDR);
    const lpTotalSupply = new BigNumber(await uniswapPair.methods.totalSupply().call()).div(this.constants.PRECISION);
    return lpTotalSupply.isZero() ? new BigNumber(0) : ethReserve.times(ethPriceInUSD).times(2).div(lpTotalSupply);
  }

  applyFeeToInterest(rawInterestAmount) {
    return new BigNumber(rawInterestAmount).times(0.9);
  }

  unapplyFeeToInterest(interestAmount) {
    return new BigNumber(interestAmount).div(0.9);
  }

  processStakeInput(input: BigNumber): string {
    return input.toFixed(18);
  }
}
