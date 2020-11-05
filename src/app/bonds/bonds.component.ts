import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult, gql } from '@apollo/client';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
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
  selectedPoolInfo: PoolInfo;

  constructor(
    private apollo: Apollo,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService
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
    this.selectPool(this.contract.getPoolInfoList()[0].name);

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
        for (const pool of dpools) {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          const stablecoin = poolInfo.stablecoin.toLowerCase()
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          const latestFundedDeposit = pool.latestFundedDeposit.length ? pool.latestFundedDeposit[0].nftID : 0;
          const latestDeposit = pool.latestDeposit.length ? pool.latestDeposit[0].nftID : 0;
          const dpoolObj: DPool = {
            name: poolInfo.name,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            iconPath: poolInfo.iconPath,
            surplus: new BigNumber(pool.surplus),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(100),
            latestFundedDeposit: latestFundedDeposit,
            latestDeposit: latestDeposit
          };
          allPoolList.push(dpoolObj);
        }
        this.allPoolList = allPoolList;
      }
    }
  }

  resetData(): void {
    this.totalDeficitFundedUSD = new BigNumber(0);
    this.totalCurrentDepositUSD = new BigNumber(0);
    this.totalInterestUSD = new BigNumber(0);
    this.totalMPHEarned = new BigNumber(0);
    this.allPoolList = [];
    this.funderPools = [];
  }

  selectPool(poolName: string) {
    this.selectedPoolInfo = this.contract.getPoolInfo(poolName);

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
    oneYearInterestRate: number;
    latestFundedDeposit: {
      nftID: number;
    }[];
    latestDeposit: {
      nftID: number;
    }[];
  }[];
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

interface DPool {
  name: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  iconPath: string;
  latestFundedDeposit: number;
  latestDeposit: number;
  surplus: BigNumber;
  oneYearInterestRate: BigNumber;
}