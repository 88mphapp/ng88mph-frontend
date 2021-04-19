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
    } else if (address.toLowerCase() === '0x06325440D014e39736583c165C2963BA99fAf14E'.toLowerCase()) {
      // CRV:STETH
      address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    } else if (address.toLowerCase() === '0x49849C98ae39Fff122806C06791Fa73784FB3675'.toLowerCase()) {
      // CRV:RENWBTC
      address = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
    } else if (address.toLowerCase() === '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3'.toLowerCase()) {
      // CRV:RENWSBTC
      address = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
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

  async getLPPriceUSD(lpTokenAddress: string): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const uniswapPair = this.contract.getContract(lpTokenAddress, 'MPHLP', readonlyWeb3);
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const token0 = await uniswapPair.methods.token0().call();
    const token1 = await uniswapPair.methods.token1().call();
    const reserve0 = new BigNumber(reservesObj._reserve0).div(this.constants.PRECISION);
    const reserve1 = new BigNumber(reservesObj._reserve1).div(this.constants.PRECISION);
    const token0PriceInUSD = await this.getTokenPriceUSD(token0);
    const token1PriceInUSD = await this.getTokenPriceUSD(token1);
    const lpTotalSupply = new BigNumber(await uniswapPair.methods.totalSupply().call()).div(this.constants.PRECISION);
    return lpTotalSupply.isZero() ? new BigNumber(0) : reserve0.times(token0PriceInUSD).plus(reserve1.times(token1PriceInUSD)).div(lpTotalSupply);
  }

  async getZCBLPPriceUSD(lpTokenAddress: string, baseTokenAddress: string): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const uniswapPair = this.contract.getContract(lpTokenAddress, 'MPHLP', readonlyWeb3);
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const token0 = await uniswapPair.methods.token0().call();
    const token1 = await uniswapPair.methods.token1().call();
    let baseTokenReserve;
    if (token0.toLowerCase() === baseTokenAddress.toLowerCase()) {
      // base token is token0
      baseTokenReserve = new BigNumber(reservesObj._reserve0).div(this.constants.PRECISION);
    } else {
      // base token is token1
      baseTokenReserve = new BigNumber(reservesObj._reserve1).div(this.constants.PRECISION);
    }
    const baseTokenPriceInUSD = await this.getTokenPriceUSD(baseTokenAddress);
    const totalValueLocked = baseTokenReserve.times(baseTokenPriceInUSD).times(2);
    const lpTotalSupply = new BigNumber(await uniswapPair.methods.totalSupply().call()).div(this.constants.PRECISION);
    return lpTotalSupply.isZero() ? new BigNumber(0) : totalValueLocked.div(lpTotalSupply);
  }

  applyFeeToInterest(rawInterestAmount, poolInfo: PoolInfo): BigNumber {
    let interestFee = 0.1;
    if (poolInfo.interestFee) {
      interestFee = poolInfo.interestFee;
    }
    return new BigNumber(rawInterestAmount).times(1 - interestFee);
  }

  applyDepositFee(rawDepositAmount, poolInfo: PoolInfo): BigNumber {
    if (!poolInfo.depositFee) {
      return rawDepositAmount;
    }
    return new BigNumber(rawDepositAmount).times(1 - poolInfo.depositFee);
  }
}
