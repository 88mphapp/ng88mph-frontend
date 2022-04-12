import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { ConstantsService } from './constants.service';
import { ContractService } from './contract.service';
import { WalletService } from './wallet.service';
import { HelpersService } from './helpers.service';
import { request, gql } from 'graphql-request';
import Web3 from 'web3';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  mphPriceUSD: BigNumber = new BigNumber(0);
  daiPriceUSD: BigNumber = new BigNumber(0);
  assetPriceUSD: any = {};

  constructor(
    public constants: ConstantsService,
    public contract: ContractService,
    public wallet: WalletService,
    public helpers: HelpersService
  ) {
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
    this.helpers
      .getTokenPriceUSD(
        this.constants.DAI[this.constants.CHAIN_ID.MAINNET],
        this.constants.CHAIN_ID.MAINNET
      )
      .then((price) => {
        this.daiPriceUSD = new BigNumber(price);
      });
  }

  async getAssetPriceUSD(address: string, networkID: number): Promise<number> {
    // add network key if one does not exist
    if (!this.assetPriceUSD[networkID]) {
      this.assetPriceUSD[networkID] = {};
    }

    // fetch asset price, adding asset key if one does not exist
    let assetPrice = this.assetPriceUSD[networkID][address];
    if (!assetPrice) {
      assetPrice = await this.helpers.getTokenPriceUSD(address, networkID);
      this.assetPriceUSD[networkID][address] = assetPrice;
    }

    return assetPrice;
  }

  // @notice max apy is based on 30-day deposit length
  async getMaxAPY(): Promise<BigNumber> {
    let maxAPY = new BigNumber(0);
    let dpools = new Array<DPool>(0);

    const queryString = gql`
      {
        dpools {
          address
        }
      }
    `;
    await request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => {
      dpools = data.dpools;
    });

    for (let dpool in dpools) {
      const apy = await this.getPoolMaxAPR(dpools[dpool].address);
      if (apy.gt(maxAPY)) {
        maxAPY = apy;
      }
    }

    return maxAPY;
  }

  async getMaxMPHAPY(): Promise<BigNumber> {
    let maxMPHAPY = new BigNumber(0);
    let dpools = new Array<DPool>(0);

    const queryString = gql`
      {
        dpools {
          address
          poolDepositorRewardMintMultiplier
        }
      }
    `;
    await request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => {
      dpools = data.dpools;
    });

    for (let dpool in dpools) {
      const apy = await this.getPoolRewardAPR(
        dpools[dpool].address,
        dpools[dpool].poolDepositorRewardMintMultiplier
      );
      if (apy.gt(maxMPHAPY)) {
        maxMPHAPY = apy;
      }
    }

    return maxMPHAPY;
  }

  async getPoolMaxAPR(address: string): Promise<BigNumber> {
    // const readonlyWeb3 = this.wallet.readonlyWeb3();
    const readonlyWeb3 = new Web3(this.constants.RPC[this.wallet.networkID]);
    const poolInfo = this.contract.getPoolInfoFromAddress(address);
    if (!poolInfo) {
      return new BigNumber(0);
    }
    const pool = this.contract.getPool(poolInfo.name, readonlyWeb3);

    // get interest amount
    const deposit = new BigNumber(10000);
    const depositLength = new BigNumber(30);
    const stablecoinPrecision = Math.pow(10, poolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(
      deposit.times(stablecoinPrecision)
    );
    const depositTime = this.helpers.processWeb3Number(
      depositLength.times(this.constants.DAY_IN_SEC)
    );
    const rawInterestAmountToken = new BigNumber(
      await pool.methods
        .calculateInterestAmount(depositAmount, depositTime)
        .call()
    );

    const interestEarnedToken = await this.helpers.applyFeeToInterest(
      rawInterestAmountToken,
      poolInfo
    );

    // get APY
    let apy = interestEarnedToken
      .div(depositAmount)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (apy.isNaN()) {
      apy = new BigNumber(0);
    }

    return apy;
  }

  async getPoolAPR(address: string, duration: number): Promise<BigNumber> {
    const web3 = this.wallet.httpsWeb3();
    const poolInfo = this.contract.getPoolInfoFromAddress(address);
    if (!poolInfo) return new BigNumber(0);

    const pool = this.contract.getPool(poolInfo.name, web3);

    // get interest amount
    const deposit = new BigNumber(10000);
    const depositLength = new BigNumber(duration);
    const stablecoinPrecision = Math.pow(10, poolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(
      deposit.times(stablecoinPrecision)
    );
    const depositTime = this.helpers.processWeb3Number(
      depositLength.times(this.constants.DAY_IN_SEC)
    );
    const rawInterestAmountToken = new BigNumber(
      await pool.methods
        .calculateInterestAmount(depositAmount, depositTime)
        .call()
    );
    const interestEarnedToken = await this.helpers.applyFeeToInterest(
      rawInterestAmountToken,
      poolInfo
    );

    let apr = interestEarnedToken
      .div(depositAmount)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (apr.isNaN()) {
      apr = new BigNumber(0);
    }

    return apr;
  }

  async getPoolRewardAPR(
    address: string,
    mintMintiplier: BigNumber
  ): Promise<BigNumber> {
    const poolInfo = this.contract.getPoolInfoFromAddress(address);
    const stablecoinPriceUSD = await this.getAssetPriceUSD(
      poolInfo.stablecoin,
      this.wallet.networkID
    );
    const rewardAPR = new BigNumber(mintMintiplier)
      .times(this.mphPriceUSD)
      .div(stablecoinPriceUSD)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);

    return new BigNumber(rewardAPR);
  }
}

interface QueryResult {
  dpools: {
    address: string;
    poolDepositorRewardMintMultiplier: BigNumber;
  }[];
}

interface DPool {
  address: string;
  poolDepositorRewardMintMultiplier: BigNumber;
}
