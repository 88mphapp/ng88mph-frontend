import BigNumber from 'bignumber.js';
import { PoolInfo } from '../contract.service';
import { Timer } from '../timer';

export interface FunderPool {
  poolInfo: PoolInfo;
  fundings: FundedDeposit[];
}

export interface Fundingv3 {
  id: number;
  active: boolean;
  totalSupply: number;
  fundedDeficitAmount: number;
  principalPerToken: number;
}

export interface Funding {
  id: number;
  pool: {
    address: string;
    oracleInterestRate: BigNumber;
    moneyMarketIncomeIndex: BigNumber;
    poolFunderRewardMultiplier: BigNumber;
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

export interface FundedDeposit {
  maturationTimestamp: number;
  countdownTimer: Timer;
  yieldTokenBalance: BigNumber;
}

export interface FundableDeposit {
  id: string;
  pool: DPool;
  maturationTimestamp: number;
  countdownTimer: Timer;
  //funding: Fundingv3;
  unfundedDepositAmount: BigNumber;
  unfundedDepositAmountUSD: BigNumber;
  yieldTokensAvailable: BigNumber;
  yieldTokensAvailableUSD: BigNumber;
  estimatedAPR: BigNumber;
  mphRewardsAPR: BigNumber;
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
  // latestFundedDeposit: number;
  // latestDeposit: number;
  surplus: BigNumber;
  oneYearInterestRate: BigNumber;
  // unfundedDepositAmount: BigNumber;
  // mphRewardPerTokenPerSecond: BigNumber;
  oracleInterestRate: BigNumber;
}
