import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { ConstantsService } from './constants.service';
import { ContractService, PoolInfo } from './contract.service';
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
    if (address.toLowerCase() === '0x5B5CFE992AdAC0C9D48E05854B2d91C73a003858'.toLowerCase()) {
      // crvHUSD
      return 1;
    } else if (address.toLowerCase() === '0xb19059ebb43466C323583928285a49f558E572Fd'.toLowerCase()) {
      // crvHBTC
      address = '0x0316EB71485b0Ab14103307bf65a021042c6d380';
    } else if (address.toLowerCase() === '0x2fE94ea3d5d4a175184081439753DE15AeF9d614'.toLowerCase()) {
      // crvOBTC
      address = '0x8064d9Ae6cDf087b1bcd5BDf3531bD5d8C537a68';
    }
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

  applyFeeToInterest(rawInterestAmount, poolInfo: PoolInfo) {
    let interestFee = 0.1;
    if (poolInfo.interestFee) {
      interestFee = poolInfo.interestFee;
    }
    return new BigNumber(rawInterestAmount).times(1 - interestFee);
  }

  unapplyFeeToInterest(interestAmount, poolInfo: PoolInfo) {
    let interestFee = 0.1;
    if (poolInfo.interestFee) {
      interestFee = poolInfo.interestFee;
    }
    return new BigNumber(interestAmount).div(1 - interestFee);
  }
}
