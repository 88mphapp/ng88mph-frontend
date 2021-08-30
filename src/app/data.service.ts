import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { ConstantsService } from './constants.service';
import { ContractService } from './contract.service';
import { WalletService } from './wallet.service';
import { HelpersService } from './helpers.service';
import { request, gql } from 'graphql-request';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(
    public constants: ConstantsService,
    public contract: ContractService,
    public wallet: WalletService,
    public helpers: HelpersService
  ) {}

  // @notice max apy is based on 7-day deposit length
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
      const apy = await this.getPoolMaxAPY(dpools[dpool].address);
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
      const apy = await this.getPoolMPHAPY(
        dpools[dpool].address,
        dpools[dpool].poolDepositorRewardMintMultiplier
      );
      if (apy.gt(maxMPHAPY)) {
        maxMPHAPY = apy;
      }
    }

    return maxMPHAPY;
  }

  async getPoolMaxAPY(address: string): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
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

  async getPoolMPHAPY(
    address: string,
    mintMintiplier: BigNumber
  ): Promise<BigNumber> {
    const poolInfo = this.contract.getPoolInfoFromAddress(address);
    const stablecoinPriceUSD = await this.helpers.getTokenPriceUSD(
      poolInfo.stablecoin
    );
    const mphPriceUSD = await this.helpers.getMPHPriceUSD();

    const rewardPerWeek = new BigNumber(mintMintiplier)
      .times(mphPriceUSD)
      .times(this.constants.DAY_IN_SEC)
      .times(7);
    let rewardAPY = rewardPerWeek
      .div(stablecoinPriceUSD)
      .div(this.constants.DAY_IN_SEC)
      .div(7)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);

    return new BigNumber(rewardAPY);
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
