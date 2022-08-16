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
  poolTVL: any = {};
  poolTVLUSD: any = {};

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
      const apy = await this.getPoolRewardAPR(dpools[dpool].address);
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

  async getPoolRewardAPR(address: string): Promise<BigNumber> {
    const vest = this.contract.getNamedContract('Vesting03');
    const poolTVL = await this.getPoolTVL(address, this.wallet.networkID, true);
    const rewardRate = await vest.methods.rewardRate(address).call();

    const mphAPR = new BigNumber(rewardRate)
      .times(this.constants.YEAR_IN_SEC)
      .times(this.mphPriceUSD)
      .div(poolTVL)
      .times(100);

    return poolTVL.eq(0) ? new BigNumber(0) : mphAPR;
  }

  async loadPoolTVL(networkID: number, usd: boolean = false) {
    const queryString = gql`
      {
        dpools {
          address
          stablecoin
          totalDeposit
        }
      }
    `;
    await request(this.constants.GRAPHQL_ENDPOINT[networkID], queryString).then(
      async (data: QueryResult) => {
        this.poolTVL[networkID] = {};
        this.poolTVLUSD[networkID] = {};

        for (const dpool of data.dpools) {
          const address = dpool.address;
          const totalDeposit = new BigNumber(dpool.totalDeposit);
          this.poolTVL[networkID][address] = totalDeposit;

          if (usd) {
            const stablecoin = dpool.stablecoin;
            if (totalDeposit.gt(0)) {
              const price = await this.getAssetPriceUSD(stablecoin, networkID);
              const totalDepositUSD = totalDeposit.times(price);
              this.poolTVLUSD[networkID][address] = totalDepositUSD;
            } else {
              this.poolTVLUSD[networkID][address] = new BigNumber(0);
            }
          }
        }
      }
    );
    return usd ? this.poolTVLUSD[networkID] : this.poolTVL[networkID];
  }

  async getPoolTVL(address: string, networkID: number, usd: boolean = false) {
    if (!this.poolTVL[networkID]) {
      this.poolTVL[networkID] = {};
    }

    let poolTVL = this.poolTVL[networkID][address];
    if (!poolTVL) {
      await this.loadPoolTVL(networkID, usd);
      poolTVL = usd
        ? this.poolTVLUSD[networkID][address]
        : this.poolTVL[networkID][address];
    }
    return poolTVL;
  }
}

interface QueryResult {
  dpools: {
    address: string;
    stablecoin: string;
    totalDeposit: string;
    poolDepositorRewardMintMultiplier: BigNumber;
  }[];
}

interface DPool {
  address: string;
  poolDepositorRewardMintMultiplier: BigNumber;
}
