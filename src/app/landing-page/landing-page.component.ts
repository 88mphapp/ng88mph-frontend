import { Component, OnInit, NgZone } from '@angular/core';
import { ConstantsService } from '../constants.service';
import { ContractService, PoolInfo } from '../contract.service';
import { WalletService } from '../wallet.service';
import { HelpersService } from '../helpers.service';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent implements OnInit {
  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;
  totalEarningsUSD: BigNumber;
  allPoolList: DPool[];
  selectedPool: DPool;
  initialDeposit: BigNumber;
  initialDepositUSD: BigNumber;
  termInDays: BigNumber;
  apy: BigNumber;
  interestEarnedToken: BigNumber;
  interestEarnedUSD: BigNumber;
  mphRewardUSD: BigNumber;
  mphRewardAPY: BigNumber;
  totalEarnedUSD: BigNumber;
  tenYearCompounded: BigNumber;
  maxAPY: BigNumber;

  constructor(
    public constants: ConstantsService,
    public contract: ContractService,
    public wallet: WalletService,
    public helpers: HelpersService,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected, true);

    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(false, true);
    });

    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      });
    });

    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();

    if (loadUser) {
    }

    if (loadGlobal) {
      const queryString = gql`
        {
          ${
            loadGlobal
              ? `dpools {
            id
            address
            totalDeposit
            oneYearInterestRate
            poolDepositorRewardMintMultiplier
          }`
              : ''
          }
        }
      `;
      request(
        this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
        queryString
      ).then((data: QueryResult) => this.handleData(data));
    }
  }

  async handleData(data: QueryResult) {
    const dpools = data.dpools;
    let stablecoinPriceCache = {};

    if (dpools) {
      let totalDepositUSD = new BigNumber(0);
      let allPoolList = new Array<DPool>(0);
      let maxAPY = new BigNumber(0);

      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          const dpoolObj: DPool = {
            name: poolInfo.name,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            iconPath: poolInfo.iconPath,
            totalDepositToken: new BigNumber(pool.totalDeposit),
            totalDepositUSD: new BigNumber(pool.totalDeposit).times(
              stablecoinPrice
            ),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate),
            oneYearAPY: this.helpers
              .applyFeeToInterest(pool.oneYearInterestRate, poolInfo)
              .times(100),
            poolDepositorRewardMintMultiplier: new BigNumber(
              pool.poolDepositorRewardMintMultiplier
            ),
          };

          totalDepositUSD = totalDepositUSD
            .plus(dpoolObj.totalDepositUSD)
            .div(1e6);
          allPoolList.push(dpoolObj);

          const poolMaxAPY = await this.calculateMaxAPY(dpoolObj);
          if (poolMaxAPY.gt(maxAPY)) {
            maxAPY = poolMaxAPY;
          }
        })
      ).then(() => {
        allPoolList.sort((a, b) => {
          const aName = a.name;
          const bName = b.name;
          if (aName > bName) {
            return 1;
          }
          if (aName < bName) {
            return -1;
          }
          return 0;
        });
        this.totalDepositUSD = totalDepositUSD;
        this.allPoolList = allPoolList;
        this.selectedPool = this.allPoolList[0];
        this.maxAPY = maxAPY;
        this.updateAPY();
      });
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
    }

    if (resetGlobal) {
      this.totalDepositUSD = new BigNumber(0);
      this.totalInterestUSD = new BigNumber(0);
      this.totalEarningsUSD = new BigNumber(0);

      const allPoolList = new Array<DPool>(0);
      const poolInfoList = this.contract.getPoolInfoList();
      for (const poolInfo of poolInfoList) {
        const dpoolObj: DPool = {
          name: poolInfo.name,
          protocol: poolInfo.protocol,
          stablecoin: poolInfo.stablecoin,
          stablecoinSymbol: poolInfo.stablecoinSymbol,
          iconPath: poolInfo.iconPath,
          totalDepositToken: new BigNumber(0),
          totalDepositUSD: new BigNumber(0),
          oneYearInterestRate: new BigNumber(0),
          oneYearAPY: new BigNumber(0),
          poolDepositorRewardMintMultiplier: new BigNumber(0),
        };
        allPoolList.push(dpoolObj);
      }
      this.allPoolList = allPoolList;
      this.selectedPool = allPoolList[0];
      this.initialDeposit = new BigNumber(10000);
      this.termInDays = new BigNumber(365);
      this.apy = new BigNumber(0);
      this.interestEarnedToken = new BigNumber(0);
      this.interestEarnedUSD = new BigNumber(0);
      this.mphRewardUSD = new BigNumber(0);
      this.mphRewardAPY = new BigNumber(0);
      this.totalEarnedUSD = new BigNumber(0);
      this.tenYearCompounded = new BigNumber(0);
      this.maxAPY = new BigNumber(0);
    }
  }

  async updateAPY() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();

    const pool = this.contract.getPool(this.selectedPool.name, readonlyWeb3);

    const poolInfo = this.contract.getPoolInfo(this.selectedPool.name);

    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      poolInfo.stablecoin
    );

    // get deposit amount USD
    this.initialDepositUSD = new BigNumber(this.initialDeposit).times(
      stablecoinPrice
    );

    // get interest amount
    const stablecoinPrecision = Math.pow(10, poolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(
      this.initialDeposit.times(stablecoinPrecision)
    );
    const depositTime = this.helpers.processWeb3Number(
      this.termInDays.times(this.constants.DAY_IN_SEC)
    );
    const rawInterestAmountToken = new BigNumber(
      await pool.methods
        .calculateInterestAmount(depositAmount, depositTime)
        .call()
    ).div(stablecoinPrecision);
    const rawInterestAmountUSD = rawInterestAmountToken.times(stablecoinPrice);
    this.interestEarnedToken = this.helpers.applyFeeToInterest(
      rawInterestAmountToken,
      poolInfo
    );
    this.interestEarnedUSD = this.helpers.applyFeeToInterest(
      rawInterestAmountUSD,
      poolInfo
    );

    // get APY
    this.apy = this.interestEarnedToken
      .div(this.initialDeposit)
      .div(this.termInDays)
      .times(365)
      .times(100);
    if (this.apy.isNaN()) {
      this.apy = new BigNumber(0);
    }

    // get MPH reward USD amount
    const mphPriceUSD = await this.helpers.getMPHPriceUSD();
    this.mphRewardUSD = this.selectedPool.poolDepositorRewardMintMultiplier
      .times(depositAmount)
      .times(depositTime)
      .times(mphPriceUSD)
      .div(this.constants.PRECISION);

    // get MPH reward APY
    const mphAPY = this.mphRewardUSD
      .div(this.initialDepositUSD)
      .div(this.termInDays)
      .times(365)
      .times(100);
    if (mphAPY.isNaN()) {
      this.mphRewardAPY = new BigNumber(0);
    } else {
      this.mphRewardAPY = mphAPY;
    }

    // calculate total earned USD
    this.totalEarnedUSD = this.initialDepositUSD.plus(
      this.interestEarnedUSD.plus(this.mphRewardUSD)
    );

    // calculate total earned when compounded over 10 years
    this.tenYearCompounded = this.initialDepositUSD.times(
      new BigNumber(100).plus(this.apy).plus(this.mphRewardAPY).div(100).pow(10)
    );
  }

  // @notice max apy is based on 7-day deposit length
  async calculateMaxAPY(dpool: DPool): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(dpool.name, readonlyWeb3);
    const poolInfo = this.contract.getPoolInfo(dpool.name);
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
    const apy = interestEarnedToken
      .div(deposit)
      .div(depositLength)
      .times(365)
      .times(100);
    if (this.apy.isNaN()) {
      this.apy = new BigNumber(0);
    }

    return apy;
  }

  setDepositAmount(amount: string): void {
    this.initialDeposit = new BigNumber(+amount);
    if (this.initialDeposit.isNaN()) {
      this.initialDeposit = new BigNumber(0);
    }
    this.updateAPY();
  }

  setTermLength(days: string): void {
    this.termInDays = new BigNumber(days);
    if (this.termInDays.isNaN()) {
      this.termInDays = new BigNumber(0);
    } else if (this.termInDays.gt(365)) {
      this.termInDays = new BigNumber(365);
    }
    this.updateAPY();
  }

  selectPool(poolName: string) {
    this.selectedPool = this.allPoolList.find((pool) => (pool.name = poolName));
    this.updateAPY();
  }
}

interface QueryResult {
  dpools: {
    id: string;
    address: string;
    totalDeposit: number;
    oneYearInterestRate: number;
    poolDepositorRewardMintMultiplier: number;
  }[];
}

interface DPool {
  name: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  iconPath: string;
  totalDepositToken: BigNumber;
  totalDepositUSD: BigNumber;
  oneYearInterestRate: BigNumber;
  oneYearAPY: BigNumber;
  poolDepositorRewardMintMultiplier: BigNumber;
}
