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
    const readonlyWeb3 = this.wallet.readonlyWeb3();
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

  async getPoolMaxAPY(address: string): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const poolInfo = this.contract.getPoolInfoFromAddress(address);
    const pool = this.contract.getPool(poolInfo.name, readonlyWeb3);
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      poolInfo.stablecoin
    );

    // get interest amount
    const deposit = new BigNumber(10000);
    const depositLength = new BigNumber(7);
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
    ).div(stablecoinPrecision);
    const interestEarnedToken = this.helpers.applyFeeToInterest(
      rawInterestAmountToken,
      poolInfo
    );

    // get APY
    let apy = interestEarnedToken
      .div(deposit)
      .div(depositLength)
      .times(365)
      .times(100);
    if (apy.isNaN()) {
      apy = new BigNumber(0);
    }

    return apy;
  }
}

interface QueryResult {
  dpools: {
    address: string;
  }[];
}

interface DPool {
  address: string;
}
