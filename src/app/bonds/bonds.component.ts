import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult, gql } from '@apollo/client';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService, PoolInfo } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';

const mockFunder = {
  totalMPHEarned: 123,
  pools: [{
    address: '0xb5EE8910A93F8A450E97BE0436F36B9458106682',
    fundings: [{
      nftID: 1,
      recordedFundedDepositAmount: 100,
      recordedMoneyMarketIncomeIndex: 1,
      initialFundedDepositAmount: 200,
      fundedDeficitAmount: 10,
      totalInterestEarned: 7,
      mintMPHAmount: 10
    }]
  }],
  totalInterestByPool: [{
    pool: {
      stablecoin: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    },
    totalDeficitFunded: 100,
    totalRecordedFundedDepositAmount: 100,
    totalInterestEarned: 20
  }]
};

@Component({
  selector: 'app-bonds',
  templateUrl: './bonds.component.html',
  styleUrls: ['./bonds.component.css']
})
export class BondsComponent implements OnInit {

  allPoolList: DPool[];
  funderPools: FunderPool[];
  totalMPHEarned: BigNumber;
  totalDeficitFundedUSD: BigNumber;
  totalCurrentDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;

  selectedPool: DPool;
  floatingRatePrediction: BigNumber;
  numDepositsToFund: string;
  numFundableDeposits: number;
  fundableDeposits: Deposit[];
  debtToFundToken: BigNumber;
  debtToFundUSD: BigNumber;
  amountToEarnOnToken: BigNumber;
  amountToEarnOnUSD: BigNumber;
  mphRewardAmount: BigNumber;
  estimatedProfitToken: BigNumber;
  estimatedROI: BigNumber;
  estimatedProfitUSD: BigNumber;
  loadingCalculator: boolean;

  constructor(
    private apollo: Apollo,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
    this.wallet.connectedEvent.subscribe(() => {
      this.loadData();
    });
    this.wallet.errorEvent.subscribe(() => {
      this.resetData();
    });
  }

  loadData(): void {
    const funderID = this.wallet.connected ? this.wallet.userAddress.toLowerCase() : '';
    const queryString = gql`
      {
        funder(id: "${funderID}") {
          totalMPHEarned
          pools {
            address
            fundings(where: { funder: "${funderID}" }, orderBy: nftID) {
              nftID
              recordedFundedDepositAmount
              recordedMoneyMarketIncomeIndex
              initialFundedDepositAmount
              fundedDeficitAmount
              totalInterestEarned
              mintMPHAmount
            }
          }
          totalInterestByPool {
            pool {
              stablecoin
            }
            totalDeficitFunded
            totalRecordedFundedDepositAmount
            totalInterestEarned
          }
        }
        dpools {
          address
          surplus
          unfundedDepositAmount
          oneYearInterestRate
          latestFundedDeposit: deposits(where: { fundingID_gt: 0 }, orderBy: nftID, orderDirection: desc, first: 1) {
            nftID
          }
          latestDeposit: deposits(orderBy: nftID, orderDirection: desc, first: 1) {
            nftID
          }
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const funder = queryResult.data.funder;
      const dpools = queryResult.data.dpools;
      let stablecoinPriceCache = {};

      if (funder) {
        // update totalMPHEarned
        this.totalMPHEarned = new BigNumber(funder.totalMPHEarned);

        // process funding list
        const funderPools: FunderPool[] = [];
        for (const pool of funder.pools) {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const stablecoin = poolInfo.stablecoin.toLowerCase()
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }
          const fundings: Array<Funding> = [];
          for (const funding of pool.fundings) {
            const fundingObj: Funding = {
              nftID: funding.nftID,
              deficitToken: new BigNumber(funding.fundedDeficitAmount),
              deficitUSD: new BigNumber(funding.fundedDeficitAmount).times(stablecoinPrice),
              currentDepositToken: new BigNumber(funding.recordedFundedDepositAmount),
              currentDepositUSD: new BigNumber(funding.recordedFundedDepositAmount).times(stablecoinPrice),
              interestEarnedToken: new BigNumber(funding.totalInterestEarned),
              interestEarnedUSD: new BigNumber(funding.totalInterestEarned).times(stablecoinPrice),
              mintMPHAmount: new BigNumber(funding.mintMPHAmount),
            }
            fundings.push(fundingObj)
          }

          const funderPool: FunderPool = {
            poolInfo: poolInfo,
            fundings: fundings
          };
          funderPools.push(funderPool);
        }
        this.funderPools = funderPools;

        // compute overall statistics
        let totalDeficitFundedUSD = new BigNumber(0);
        let totalCurrentDepositUSD = new BigNumber(0);
        let totalInterestUSD = new BigNumber(0);
        for (const totalInterestEntity of funder.totalInterestByPool) {
          let stablecoinPrice = stablecoinPriceCache[totalInterestEntity.pool.stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(totalInterestEntity.pool.stablecoin);
            stablecoinPriceCache[totalInterestEntity.pool.stablecoin] = stablecoinPrice;
          }

          const poolDeficitFundedUSD = new BigNumber(totalInterestEntity.totalDeficitFunded).times(stablecoinPrice);
          const poolCurrentDepositUSD = new BigNumber(totalInterestEntity.totalRecordedFundedDepositAmount).times(stablecoinPrice);
          const poolInterestUSD = new BigNumber(totalInterestEntity.totalInterestEarned).times(stablecoinPrice);
          totalDeficitFundedUSD = totalDeficitFundedUSD.plus(poolDeficitFundedUSD);
          totalCurrentDepositUSD = totalCurrentDepositUSD.plus(poolCurrentDepositUSD);
          totalInterestUSD = totalInterestUSD.plus(poolInterestUSD);
        }
        this.totalDeficitFundedUSD = totalDeficitFundedUSD;
        this.totalCurrentDepositUSD = totalCurrentDepositUSD;
        this.totalInterestUSD = totalInterestUSD;
      }

      if (dpools) {
        const allPoolList = new Array<DPool>(0);
        const mphMinter = this.contract.getNamedContract('MPHMinter');
        for (const pool of dpools) {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const stablecoinPrecision = Math.pow(10, poolInfo.stablecoinDecimals);

          const stablecoin = poolInfo.stablecoin.toLowerCase()
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          // get MPH reward amount
          const poolMintingMultiplier = new BigNumber(await mphMinter.methods.poolMintingMultiplier(poolInfo.address).call()).div(this.constants.PRECISION);
          const poolFunderRewardMultiplier = new BigNumber(await mphMinter.methods.poolFunderRewardMultiplier(poolInfo.address).call()).div(this.constants.PRECISION);
          const mphRewardPerToken = poolMintingMultiplier.times(stablecoinPrecision).div(this.constants.PRECISION).times(poolFunderRewardMultiplier);

          const latestFundedDeposit = pool.latestFundedDeposit.length ? pool.latestFundedDeposit[0].nftID : 0;
          const latestDeposit = pool.latestDeposit.length ? pool.latestDeposit[0].nftID : 0;
          const dpoolObj: DPool = {
            name: poolInfo.name,
            address: poolInfo.address,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            stablecoinDecimals: poolInfo.stablecoinDecimals,
            iconPath: poolInfo.iconPath,
            surplus: new BigNumber(pool.surplus),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(100),
            latestFundedDeposit: latestFundedDeposit,
            latestDeposit: latestDeposit,
            unfundedDepositAmount: new BigNumber(pool.unfundedDepositAmount),
            mphRewardPerToken: mphRewardPerToken
          };
          allPoolList.push(dpoolObj);
        }
        this.allPoolList = allPoolList;

        this.selectPool(0);
      }
    }
  }

  resetData(): void {
    this.totalDeficitFundedUSD = new BigNumber(0);
    this.totalCurrentDepositUSD = new BigNumber(0);
    this.totalInterestUSD = new BigNumber(0);
    this.totalMPHEarned = new BigNumber(0);
    this.floatingRatePrediction = new BigNumber(0);
    this.allPoolList = [];
    this.funderPools = [];
    this.numDepositsToFund = 'All';
    this.numFundableDeposits = 0;
    this.fundableDeposits = [];
    this.debtToFundToken = new BigNumber(0);
    this.debtToFundUSD = new BigNumber(0);
    this.amountToEarnOnToken = new BigNumber(0);
    this.amountToEarnOnUSD = new BigNumber(0);
    this.mphRewardAmount = new BigNumber(0);
    this.estimatedProfitToken = new BigNumber(0);
    this.estimatedProfitUSD = new BigNumber(0);
    this.estimatedROI = new BigNumber(0);
    this.loadingCalculator = true;
  }

  selectPool(poolIdx: number) {
    this.selectedPool = this.allPoolList[poolIdx];
    this.floatingRatePrediction = this.selectedPool.oneYearInterestRate.times(4 / 3);
    this.numFundableDeposits = Math.min(this.selectedPool.latestDeposit - this.selectedPool.latestFundedDeposit - 1, 20);

    const poolID = this.selectedPool.address.toLowerCase();
    const queryString = gql`
      {
        dpool(id: "${poolID}") {
          deposits(where: { nftID_gt: ${this.selectedPool.latestFundedDeposit} }, orderBy: nftID) {
            nftID
            amount
            active
            maturationTimestamp
            interestEarned
            initialMoneyMarketIncomeIndex
          }
        }
      }
    `;
    this.apollo.query<FundableDepositsQuery>({
      query: queryString
    }).subscribe(async (x) => {
      const fundableDeposits = [];
      const pool = this.contract.getPool(this.allPoolList[poolIdx].name);
      const moneyMarketIncomeIndex = new BigNumber(await pool.methods.moneyMarketIncomeIndex().call()).div(this.constants.PRECISION);
      for (const deposit of x.data.dpool.deposits) {
        const surplus = moneyMarketIncomeIndex.div(deposit.initialMoneyMarketIncomeIndex).minus(1).times(deposit.amount).minus(deposit.interestEarned);
        const parsedDeposit: Deposit = {
          nftID: deposit.nftID,
          amount: new BigNumber(deposit.amount),
          active: deposit.active,
          maturationTimestamp: deposit.maturationTimestamp,
          interestEarned: new BigNumber(deposit.interestEarned),
          surplus: surplus
        }
        fundableDeposits.push(parsedDeposit);
      }
      this.fundableDeposits = fundableDeposits;

      this.updateNumDepositsToFund(this.numFundableDeposits + 1);
    });
  }

  selectedPoolHasDebt(): boolean {
    if (!this.selectedPool) {
      return false;
    }
    return this.selectedPool.surplus.lt(0) && this.numFundableDeposits > 0;
  }

  updateFloatingRatePrediction(newPrediction: number) {
    this.floatingRatePrediction = new BigNumber(newPrediction);
    this.updateEstimatedROI();
  }

  async updateNumDepositsToFund(newNum: number) {
    if (newNum > this.numFundableDeposits) {
      // fund all deposits
      this.numDepositsToFund = 'All';
      this.debtToFundToken = this.selectedPool.surplus.times(-1);
      this.amountToEarnOnToken = this.selectedPool.unfundedDepositAmount;
    } else {
      this.numDepositsToFund = newNum.toString();
      let debtToFundToken = new BigNumber(0);
      let amountToEarnOnToken = new BigNumber(0);
      for (const deposit of this.fundableDeposits.slice(0, newNum)) {
        if (!deposit.active) continue;
        debtToFundToken = debtToFundToken.plus(deposit.surplus.times(-1));
        amountToEarnOnToken = amountToEarnOnToken.plus(deposit.amount);
      }
      this.debtToFundToken = debtToFundToken;
      this.amountToEarnOnToken = amountToEarnOnToken;
    }
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(this.selectedPool.stablecoin);
    this.debtToFundUSD = this.debtToFundToken.times(stablecoinPrice);
    this.amountToEarnOnUSD = this.amountToEarnOnToken.times(stablecoinPrice);

    this.mphRewardAmount = this.selectedPool.mphRewardPerToken.times(this.debtToFundToken);

    this.updateEstimatedROI();
  }

  async updateEstimatedROI() {
    // compute estimated ROI
    const estimatedFloatingRate = this.floatingRatePrediction.div(100);
    let estimatedInterest = new BigNumber(0);
    const now = Date.now() / 1e3;
    const numDepositsToFund = isNaN(+this.numDepositsToFund) ? this.fundableDeposits.length : +this.numDepositsToFund;
    for (const deposit of this.fundableDeposits.slice(0, numDepositsToFund)) {
      if (!deposit.active || deposit.maturationTimestamp < now) continue;
      const depositInterest = deposit.amount.times(estimatedFloatingRate).times(deposit.maturationTimestamp - now).div(this.constants.YEAR_IN_SEC);
      estimatedInterest = estimatedInterest.plus(depositInterest);
    }
    this.estimatedProfitToken = estimatedInterest.minus(this.debtToFundToken);
    this.estimatedProfitUSD = this.estimatedProfitToken.times(await this.helpers.getTokenPriceUSD(this.selectedPool.stablecoin.toLowerCase()));
    this.estimatedROI = this.estimatedProfitToken.div(this.debtToFundToken).times(100);

    this.loadingCalculator = false;
  }

  buyBond() {
    const pool = this.contract.getPool(this.selectedPool.name);
    const stablecoin = this.contract.getPoolStablecoin(this.selectedPool.name);
    const stablecoinPrecision = Math.pow(10, this.selectedPool.stablecoinDecimals);
    const debtToFund = this.helpers.processWeb3Number(this.debtToFundToken.times(stablecoinPrecision));
    let func;
    if (this.numDepositsToFund === 'All') {
      // Fund all deposits
      func = pool.methods.fundAll();
    } else {
      // Fund a selection of deposits
      func = pool.methods.fundMultiple(this.selectedPool.latestFundedDeposit + (+this.numDepositsToFund));
    }
    this.wallet.sendTxWithToken(func, stablecoin, this.selectedPool.address, debtToFund, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) })
  }
}

interface QueryResult {
  funder: {
    totalMPHEarned: number;
    pools: {
      address: string;
      fundings: {
        nftID: number;
        recordedFundedDepositAmount: number;
        recordedMoneyMarketIncomeIndex: number;
        initialFundedDepositAmount: number;
        fundedDeficitAmount: number;
        totalInterestEarned: number;
        mintMPHAmount: number;
      }[];
    }[];
    totalInterestByPool: {
      pool: {
        stablecoin: string;
      };
      totalDeficitFunded: number;
      totalRecordedFundedDepositAmount: number;
      totalInterestEarned: number;
    }[];
  };
  dpools: {
    address: string;
    surplus: number;
    unfundedDepositAmount: number;
    oneYearInterestRate: number;
    latestFundedDeposit: {
      nftID: number;
    }[];
    latestDeposit: {
      nftID: number;
    }[];
  }[];
}

interface FundableDepositsQuery {
  dpool: {
    deposits: {
      nftID: number;
      amount: number;
      active: boolean;
      maturationTimestamp: number;
      interestEarned: number;
      initialMoneyMarketIncomeIndex: number;
    }[];
  };
}

interface FunderPool {
  poolInfo: PoolInfo;
  fundings: Funding[];
}

interface Funding {
  nftID: number;
  deficitToken: BigNumber;
  deficitUSD: BigNumber;
  currentDepositToken: BigNumber;
  currentDepositUSD: BigNumber;
  interestEarnedToken: BigNumber;
  interestEarnedUSD: BigNumber;
  mintMPHAmount: BigNumber;
}

interface Deposit {
  nftID: number;
  amount: BigNumber;
  active: boolean;
  maturationTimestamp: number;
  interestEarned: BigNumber;
  surplus: BigNumber;
}

interface DPool {
  name: string;
  address: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  stablecoinDecimals: number;
  iconPath: string;
  latestFundedDeposit: number;
  latestDeposit: number;
  surplus: BigNumber;
  oneYearInterestRate: BigNumber;
  unfundedDepositAmount: BigNumber;
  mphRewardPerToken: BigNumber;
}