import Web3 from 'web3';
import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { ConstantsService } from './constants.service';
import { ContractService, PoolInfo } from './contract.service';
import { WalletService } from './wallet.service';
import { request, gql } from 'graphql-request';

@Injectable({
  providedIn: 'root',
})
export class HelpersService {
  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService
  ) {}

  async getTokenPriceUSD(
    tokenAddress: string,
    chainID: number
  ): Promise<number> {
    const address = tokenAddress.toLowerCase();

    if (address === this.constants.AAVE[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('AAVE', chainID);
    } else if (address === this.constants.BAL[chainID].toLowerCase()) {
      return await this.getChainlinkPriceETH('BAL', chainID);
    } else if (address === this.constants.BAT[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('BAT', chainID);
    } else if (address === this.constants.BNT[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('BNT', chainID);
    } else if (address === this.constants.COMP[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('COMP', chainID);
    } else if (address === this.constants.CRV[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('CRV', chainID);
    } else if (address === this.constants.CRVHUSD[chainID].toLowerCase()) {
      return 1;
    } else if (address === this.constants.DAI[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('DAI', chainID);
    } else if (address === this.constants.FARM[chainID].toLowerCase()) {
      return await this.getChainlinkPriceETH('FARM', chainID);
    } else if (address === this.constants.FTT[chainID].toLowerCase()) {
      return await this.getChainlinkPriceETH('FTT', chainID);
    } else if (address === this.constants.FUSD[chainID].toLowerCase()) {
      return 1;
    } else if (address === this.constants.GUSD[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('USDC', chainID);
    } else if (address === this.constants.LINK[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('LINK', chainID);
    } else if (address === this.constants.RAI[chainID].toLowerCase()) {
      return await this.getChainlinkPriceETH('RAI', chainID);
    } else if (address === this.constants.REN[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('REN', chainID);
    } else if (address === this.constants.SNX[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('SNX', chainID);
    } else if (address === this.constants.SUSD[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('SUSD', chainID);
    } else if (address === this.constants.SUSHI[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('SUSHI', chainID);
    } else if (address === this.constants.TUSD[chainID].toLowerCase()) {
      return await this.getChainlinkPriceETH('TUSD', chainID);
    } else if (address === this.constants.UNI[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('UNI', chainID);
    } else if (address === this.constants.USDC[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('USDC', chainID);
    } else if (address === this.constants.USDP[chainID].toLowerCase()) {
      return await this.getChainlinkPriceETH('USDP', chainID);
    } else if (address === this.constants.USDT[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('USDT', chainID);
    } else if (address === this.constants.WAVAX[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('AVAX', chainID);
    } else if (address === this.constants.WFTM[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('FTM', chainID);
    } else if (address === this.constants.WMATIC[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('MATIC', chainID);
    } else if (address === this.constants.YFI[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('YFI', chainID);
    } else if (address === this.constants.ZRX[chainID].toLowerCase()) {
      return await this.getChainlinkPriceUSD('ZRX', chainID);
    } else if (
      address === this.constants.WBTC[chainID].toLowerCase() ||
      address === this.constants.CRVHBTC[chainID].toLowerCase() ||
      address === this.constants.CRVOBTC[chainID].toLowerCase() ||
      address === this.constants.CRVRENWBTC[chainID].toLowerCase() ||
      address === this.constants.CRVRENWSBTC[chainID].toLowerCase()
    ) {
      return await this.getChainlinkPriceUSD('BTC', chainID);
    } else if (
      address === this.constants.WETH[chainID].toLowerCase() ||
      address === this.constants.STECRV[chainID].toLowerCase()
    ) {
      return await this.getChainlinkPriceUSD('ETH', chainID);
    }

    // console.log("no chainlink price feed for: " + address);
    let chain: string = 'ethereum';
    if (
      chainID === this.constants.CHAIN_ID.FANTOM &&
      address !== this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET]
    ) {
      chain = 'fantom';
    }
    const apiStr = `https://api.coingecko.com/api/v3/coins/${chain}/contract/${address}/market_chart/?vs_currency=usd&days=0`;
    const rawResult = await this.httpsGet(apiStr, 300);
    return rawResult.prices[0][1];
  }

  async getHistoricalTokenPriceUSD(
    tokenAddress: string,
    days: string,
    blocks: number[],
    timestamps: number[],
    chainID: number,
    useChainlink: boolean = true
  ): Promise<Array<Array<number>>> {
    let address = tokenAddress.toLowerCase();

    if (chainID === this.constants.CHAIN_ID.MAINNET && useChainlink) {
      if (address === this.constants.AAVE[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'AAVE',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.BAL[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesETH(
          'BAL',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.BAT[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'BAT',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.BNT[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'BNT',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.COMP[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'COMP',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.CRV[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'CRV',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.DAI[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'DAI',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.FARM[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesETH(
          'FARM',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.FTT[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesETH(
          'FTT',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.GUSD[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'USDC',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.LINK[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'LINK',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.RAI[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesETH(
          'RAI',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.REN[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'REN',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.SNX[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'SNX',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.SUSD[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'sUSD',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.SUSHI[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'SUSHI',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.TUSD[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesETH(
          'TUSD',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.UNI[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'UNI',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.USDC[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'USDC',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.USDP[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesETH(
          'PAX',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.USDT[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'USDT',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.YFI[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'YFI',
          blocks,
          timestamps,
          chainID
        );
      } else if (address === this.constants.ZRX[chainID].toLowerCase()) {
        return await this.getHistoricalChainlinkPricesUSD(
          'ZRX',
          blocks,
          timestamps,
          chainID
        );
      } else if (
        address === this.constants.WBTC[chainID].toLowerCase() ||
        address === this.constants.CRVHBTC[chainID].toLowerCase() ||
        address === this.constants.CRVOBTC[chainID].toLowerCase() ||
        address === this.constants.CRVRENWBTC[chainID].toLowerCase() ||
        address === this.constants.CRVRENWSBTC[chainID].toLowerCase()
      ) {
        return await this.getHistoricalChainlinkPricesUSD(
          'BTC',
          blocks,
          timestamps,
          chainID
        );
      } else if (
        address === this.constants.WETH[chainID].toLowerCase() ||
        address === this.constants.STECRV[chainID].toLowerCase()
      ) {
        return await this.getHistoricalChainlinkPricesUSD(
          'ETH',
          blocks,
          timestamps,
          chainID
        );
      }
    }

    if (
      address === this.constants.FUSD[this.constants.CHAIN_ID.FANTOM] ||
      address === this.constants.CRVHUSD[this.constants.CHAIN_ID.MAINNET]
    ) {
      let prices: number[][] = [];
      for (let t in timestamps) {
        const timestamp = timestamps[t] * 1000;
        prices[t] = [timestamp, 1];
      }
      return prices;
    }

    if (
      address !== this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET]
    ) {
      address = this.getMainnetAddress(address, chainID);
    }

    let apiStr;
    if (address === this.constants.WAVAX[chainID]) {
      apiStr = `https://api.coingecko.com/api/v3/coins/avalanche/contract/${address}/market_chart/?vs_currency=usd&days=${days}`;
    } else {
      apiStr = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}/market_chart/?vs_currency=usd&days=${days}`;
    }
    const rawResult = await this.httpsGet(apiStr, 300);
    return rawResult.prices;
  }

  getMainnetAddress(tokenAddress: string, chainID: number): string {
    const address = tokenAddress.toLowerCase();

    if (address === this.constants.DAI[chainID]) {
      return this.constants.DAI[this.constants.CHAIN_ID.MAINNET];
    } else if (address === this.constants.LINK[chainID]) {
      return this.constants.LINK[this.constants.CHAIN_ID.MAINNET];
    } else if (address === this.constants.USDC[chainID]) {
      return this.constants.USDC[this.constants.CHAIN_ID.MAINNET];
    } else if (address === this.constants.USDT[chainID]) {
      return this.constants.USDT[this.constants.CHAIN_ID.MAINNET];
    } else if (
      address === this.constants.WBTC[chainID] ||
      address === this.constants.CRVOBTC[chainID] ||
      address === this.constants.CRVHBTC[chainID]
    ) {
      return this.constants.WBTC[this.constants.CHAIN_ID.MAINNET];
    } else if (
      address === this.constants.WETH[chainID] ||
      address === this.constants.STECRV[chainID]
    ) {
      return this.constants.WETH[this.constants.CHAIN_ID.MAINNET];
    } else if (address === this.constants.WFTM[chainID]) {
      return this.constants.WFTM[this.constants.CHAIN_ID.MAINNET];
    } else if (address === this.constants.WMATIC[chainID]) {
      return this.constants.WMATIC[this.constants.CHAIN_ID.MAINNET];
    }

    // console.log(
    //   'Historical price lookup for ' + address + ' has not been set up yet'
    // );
    return address;
  }

  processWeb3Number(number): string {
    return new BigNumber(number).integerValue().toFixed();
  }

  async httpsGet(apiStr, cacheMaxAge: number = 30) {
    const request = await fetch(apiStr, {
      headers: { 'Cache-Control': `max-age=${cacheMaxAge}` },
    });
    return await request.json();
  }

  async getHistoricalMPHMarketCap(days: string): Promise<Array<any>> {
    const apiStr = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${
      this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET]
    }/market_chart/?vs_currency=usd&days=${days}`;
    const rawResult = await this.httpsGet(apiStr, 300);
    return rawResult.market_caps;
  }

  async getMPHPriceUSD(): Promise<BigNumber> {
    return new BigNumber(
      await this.getTokenPriceUSD(
        this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET],
        this.wallet.networkID
      )
    );
  }

  async getChainlinkPriceUSD(symbol: string, chainID: number): Promise<number> {
    const readonlyWeb3 = new Web3(this.constants.RPC[chainID]);
    const chainlinkAddress = require(`src/assets/json/chainlink.json`)[chainID][
      symbol
    ]['USD'];

    if (chainlinkAddress !== '') {
      const oracleContract = this.contract.getContract(
        chainlinkAddress,
        'ChainlinkOracle',
        readonlyWeb3
      );
      const tokenPriceUSD =
        (await oracleContract.methods.latestAnswer().call()) / 1e8;
      return tokenPriceUSD;
    } else {
      console.log(symbol + '/USD price feed does not exist.');
      return 0;
    }
  }

  async getChainlinkPriceETH(symbol: string, chainID: number): Promise<number> {
    const ethPriceUSD: number = await this.getChainlinkPriceUSD('ETH', chainID);
    const readonlyWeb3 = new Web3(this.constants.RPC[chainID]);
    const chainlinkAddress = require(`src/assets/json/chainlink.json`)[chainID][
      symbol
    ]['ETH'];

    if (chainlinkAddress !== '') {
      const oracleContract = this.contract.getContract(
        chainlinkAddress,
        'ChainlinkOracle',
        readonlyWeb3
      );
      const tokenPriceETH =
        (await oracleContract.methods.latestAnswer().call()) / 1e18;
      return tokenPriceETH * ethPriceUSD;
    } else {
      console.log(symbol + '/ETH price feed does not exist.');
      return 0;
    }
  }

  async getHistoricalChainlinkPricesUSD(
    symbol: string,
    blocks: number[],
    timestamps: number[],
    chainID: number
  ): Promise<Array<Array<number>>> {
    // let allPrices: number[][] = [];
    // let count: number = 0;
    // while (count < timestamps.length) {
    //   let limit = timestamps.length - count;
    //   if (limit > 100) {
    //     limit = 100;
    //   }
    //   let queryString = `query HistoricalChainlinkPricesUSD {`;
    //   for (let i = count; i < count + limit; i++) {
    //     queryString += `t${i}: prices(
    //       block: {
    //         number: ${blocks[i]}
    //       }
    //       where: {
    //         assetPair: "${symbol}/USD"
    //       }
    //       first: 1
    //       orderBy: timestamp
    //       orderDirection: desc
    //     ) {
    //       price
    //     }`;
    //   }
    //   queryString += `}`;
    //   const query = gql`
    //     ${queryString}
    //   `;
    //
    //   const prices: number[][] = await request(
    //     this.constants.CHAINLINK_GRAPHQL_ENDPOINT[chainID],
    //     query
    //   ).then((data: ChainlinkQueryResult) => {
    //     let prices: number[][] = [];
    //     for (let t in data) {
    //       const index = parseInt(t.substring(1));
    //       const timestamp = timestamps[index] * 1000;
    //       const price = parseFloat(data[t][0].price) / 1e8;
    //       prices[index] = [timestamp, price];
    //     }
    //     return prices;
    //   });
    //   count += limit;
    //   allPrices = allPrices.concat(prices);
    //   //return prices;
    // }
    // return allPrices;

    let queryString = `query HistoricalChainlinkPricesUSD {`;
    for (let i = 0; i < blocks.length; i++) {
      queryString += `t${i}: prices(
        block: {
          number: ${blocks[i]}
        }
        where: {
          assetPair: "${symbol}/USD"
        }
        first: 1
        orderBy: timestamp
        orderDirection: desc
      ) {
        price
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    const prices: number[][] = await request(
      this.constants.CHAINLINK_GRAPHQL_ENDPOINT[chainID],
      query
    ).then((data: ChainlinkQueryResult) => {
      let prices: number[][] = [];
      for (let t in data) {
        const index = parseInt(t.substring(1));
        const timestamp = timestamps[index] * 1000;
        const price = parseFloat(data[t][0].price) / 1e8;
        prices[index] = [timestamp, price];
      }
      return prices;
    });
    return prices;
  }

  async getHistoricalChainlinkPricesETH(
    symbol: string,
    blocks: number[],
    timestamps: number[],
    chainID: number
  ): Promise<Array<Array<number>>> {
    const ethPricesUSD: number[][] = await this.getHistoricalChainlinkPricesUSD(
      'ETH',
      blocks,
      timestamps,
      chainID
    );

    let queryString = `query HistoricalChainlinkPricesETH {`;
    for (let i = 0; i < blocks.length; i++) {
      queryString += `t${i}: prices(
        block: {
          number: ${blocks[i]}
        }
        where: {
          assetPair: "${symbol}/ETH"
        }
        first: 1
        orderBy: timestamp
        orderDirection: desc
      ) {
        price
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    const prices: number[][] = await request(
      this.constants.CHAINLINK_GRAPHQL_ENDPOINT[chainID],
      query
    ).then((data: ChainlinkQueryResult) => {
      let prices: number[][] = [];
      for (let t in data) {
        const index = parseInt(t.substring(1));
        const timestamp = timestamps[index] * 1000;
        const price = parseFloat(data[t][0].price) / 1e18;
        const ethPriceUSD = ethPricesUSD.find(
          (price) => price[0] === timestamp
        )[1];
        prices[index] = [timestamp, price * ethPriceUSD];
      }
      return prices;
    });
    return prices;
  }

  async getMPHLPPriceUSD(): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3(
      this.constants.CHAIN_ID.MAINNET
    );
    const uniswapPair = this.contract.getNamedContract(
      'MPHLP',
      readonlyWeb3,
      this.constants.CHAIN_ID.MAINNET
    );
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const ethReserve = new BigNumber(reservesObj._reserve1).div(
      this.constants.PRECISION
    );
    const ethPriceInUSD = await this.getTokenPriceUSD(
      this.constants.WETH[this.wallet.networkID],
      this.wallet.networkID
    );
    const lpTotalSupply = new BigNumber(
      await uniswapPair.methods.totalSupply().call()
    ).div(this.constants.PRECISION);
    return lpTotalSupply.isZero()
      ? new BigNumber(0)
      : ethReserve.times(ethPriceInUSD).times(2).div(lpTotalSupply);
  }

  async getLPPriceUSD(lpTokenAddress: string): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const uniswapPair = this.contract.getContract(
      lpTokenAddress,
      'MPHLP',
      readonlyWeb3
    );
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const token0 = await uniswapPair.methods.token0().call();
    const token1 = await uniswapPair.methods.token1().call();
    const reserve0 = new BigNumber(reservesObj._reserve0).div(
      this.constants.PRECISION
    );
    const reserve1 = new BigNumber(reservesObj._reserve1).div(
      this.constants.PRECISION
    );
    const token0PriceInUSD = await this.getTokenPriceUSD(
      token0,
      this.wallet.networkID
    );
    const token1PriceInUSD = await this.getTokenPriceUSD(
      token1,
      this.wallet.networkID
    );
    const lpTotalSupply = new BigNumber(
      await uniswapPair.methods.totalSupply().call()
    ).div(this.constants.PRECISION);
    return lpTotalSupply.isZero()
      ? new BigNumber(0)
      : reserve0
          .times(token0PriceInUSD)
          .plus(reserve1.times(token1PriceInUSD))
          .div(lpTotalSupply);
  }

  async getBPTPriceUSD(): Promise<BigNumber> {
    const web3 = this.wallet.readonlyWeb3();
    const bpt = this.contract.getNamedContract('balMPH', web3);
    // const bpt = this.contract.getContract("0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56", 'balMPH', web3);
    const vault = this.contract.getNamedContract('BalancerVault', web3);

    const poolID = await bpt.methods.getPoolId().call();
    const details = await vault.methods.getPoolTokens(poolID).call();

    const token0 = details.tokens[0];
    const token0Balance = new BigNumber(details.balances[0]).div(
      this.constants.PRECISION
    );
    const token0PriceUSD = await this.getTokenPriceUSD(
      token0,
      this.wallet.networkID
    );

    const token1 = details.tokens[1];
    const token1Balance = new BigNumber(details.balances[1]).div(
      this.constants.PRECISION
    );
    const token1PriceUSD = await this.getTokenPriceUSD(
      token1,
      this.wallet.networkID
    );

    const bptSupply = new BigNumber(await bpt.methods.totalSupply().call()).div(
      this.constants.PRECISION
    );

    return bptSupply.isZero()
      ? new BigNumber(0)
      : token0Balance
          .times(token0PriceUSD)
          .plus(token1Balance.times(token1PriceUSD))
          .div(bptSupply);
  }

  async getZCBLPPriceUSD(
    lpTokenAddress: string,
    baseTokenAddress: string
  ): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const uniswapPair = this.contract.getContract(
      lpTokenAddress,
      'MPHLP',
      readonlyWeb3
    );
    const reservesObj = await uniswapPair.methods.getReserves().call();
    const token0 = await uniswapPair.methods.token0().call();
    const token1 = await uniswapPair.methods.token1().call();
    let baseTokenReserve;
    if (token0.toLowerCase() === baseTokenAddress.toLowerCase()) {
      // base token is token0
      baseTokenReserve = new BigNumber(reservesObj._reserve0).div(
        this.constants.PRECISION
      );
    } else {
      // base token is token1
      baseTokenReserve = new BigNumber(reservesObj._reserve1).div(
        this.constants.PRECISION
      );
    }
    const baseTokenPriceInUSD = await this.getTokenPriceUSD(
      baseTokenAddress,
      this.wallet.networkID
    );
    const totalValueLocked = baseTokenReserve
      .times(baseTokenPriceInUSD)
      .times(2);
    const lpTotalSupply = new BigNumber(
      await uniswapPair.methods.totalSupply().call()
    ).div(this.constants.PRECISION);
    return lpTotalSupply.isZero()
      ? new BigNumber(0)
      : totalValueLocked.div(lpTotalSupply);
  }

  async applyFeeToInterest(
    rawInterestAmount: BigNumber,
    poolInfo: PoolInfo
  ): Promise<BigNumber> {
    const readonlyWeb3 = new Web3(this.constants.RPC[this.wallet.networkID]);
    const pool = this.contract.getPool(poolInfo.name, readonlyWeb3);
    const feeModelAddress = await pool.methods.feeModel().call();
    const feeModelContract = this.contract.getContract(
      feeModelAddress,
      'IFeeModel',
      readonlyWeb3
    );
    const interestAmount = this.processWeb3Number(rawInterestAmount);
    const feeAmount = await feeModelContract.methods
      .getInterestFeeAmount(poolInfo.address, interestAmount)
      .call();

    return new BigNumber(rawInterestAmount).minus(feeAmount);
  }

  applyDepositFee(rawDepositAmount, poolInfo: PoolInfo): BigNumber {
    if (!poolInfo.depositFee) {
      return rawDepositAmount;
    }
    return new BigNumber(rawDepositAmount).times(1 - poolInfo.depositFee);
  }

  parseInterestRate(oracleInterestRate: BigNumber, time: number): BigNumber {
    return new BigNumber(
      Math.pow(2, oracleInterestRate.times(time).toNumber()) - 1
    );
  }
}

interface ChainlinkQueryResult {
  prices: {
    price: string;
  }[];
}
