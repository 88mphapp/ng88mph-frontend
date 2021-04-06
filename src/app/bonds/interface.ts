import BigNumber from "bignumber.js";
import { PoolInfo } from "../contract.service";

export interface FunderPool {
  poolInfo: PoolInfo;
  fundings: Funding[];
}

export interface Funding {
  id: number;
  pool: {
    address: string;
    oracleInterestRate: BigNumber;
    moneyMarketIncomeIndex: BigNumber;
    mphFunderRewardMultiplier: BigNumber;
  };
  fromDepositID: number;
  toDepositID: number;
  nftID: number;
  deficitToken: BigNumber;
  deficitUSD: BigNumber;
  currentDepositToken: BigNumber;
  currentDepositUSD: BigNumber;
  interestEarnedToken: BigNumber;
  interestEarnedUSD: BigNumber;
  mphRewardEarned: BigNumber;
  refundAmountToken: BigNumber;
  refundAmountUSD: BigNumber;
  recordedMoneyMarketIncomeIndex: BigNumber;
  creationTimestamp: number;
}

export interface Deposit {
  nftID: number;
  amount: BigNumber;
  active: boolean;
  maturationTimestamp: number;
  interestEarned: BigNumber;
  surplus: BigNumber;
}

export interface DPool {
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
  mphRewardPerTokenPerSecond: BigNumber;
  oracleInterestRate: BigNumber;
}