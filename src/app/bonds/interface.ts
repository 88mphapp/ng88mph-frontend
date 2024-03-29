import BigNumber from 'bignumber.js';
import { PoolInfo } from '../contract.service';
import { Timer } from '../timer';

export interface FunderPool {
  poolInfo: PoolInfo;
  fundings: FundedDeposit[];
  userTotalYieldTokenBalance: BigNumber;
  userTotalYieldTokenBalanceUSD: BigNumber;
  userTotalEarnYieldOn: BigNumber;
  userTotalEarnYieldOnUSD: BigNumber;
  userTotalYieldEarned: BigNumber;
  userTotalYieldEarnedUSD: BigNumber;
  userTotalRefundedAmount: BigNumber;
  userTotalRefundedAmountUSD: BigNumber;
  userTotalMPHRewardsEarned: BigNumber;
  userTotalMPHRewardsEarnedUSD: BigNumber;
  userTotalCurrentROI: BigNumber;
  isExpanded: boolean;
}

export interface Funding {
  id: number;
  active: boolean;
  totalSupply: number;
  fundedDeficitAmount: number;
  principalPerToken: number;
}

export interface FundedDeposit {
  yieldToken: any;
  yieldTokenAddress: string;
  fundingID: number;
  stablecoinPrice: number;
  funderAccruedInterest: BigNumber;
  funderAccruedMPH: BigNumber;
  maturationTimestamp: number;
  yieldTokenBalance: BigNumber;
  yieldTokenBalanceUSD: BigNumber;
  earnYieldOn: BigNumber;
  earnYieldOnUSD: BigNumber;
  yieldEarned: BigNumber;
  yieldEarnedUSD: BigNumber;
  refundedAmount: BigNumber;
  refundedAmountUSD: BigNumber;
  mphRewardsEarned: BigNumber;
  mphRewardsEarnedUSD: BigNumber;
  principalPerToken: BigNumber;
  currentROI: BigNumber;
}

export interface FundableDeposit {
  id: string;
  pool: DPool;
  maturationTimestamp: number;
  unfundedDepositAmount: BigNumber;
  unfundedDepositAmountUSD: BigNumber;
  yieldTokensAvailable: BigNumber;
  yieldTokensAvailableUSD: BigNumber;
  yieldTokensAvailableToken: BigNumber;
  estimatedAPR: BigNumber;
}

export interface DPool {
  name: string;
  address: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  stablecoinDecimals: number;
  iconPath: string;
  oneYearInterestRate: BigNumber;
  oracleInterestRate: BigNumber;
  poolFundableDeposits: FundableDeposit[];
  totalYieldTokensAvailable: BigNumber;
  totalYieldTokensAvailableUSD: BigNumber;
  totalYieldTokensAvailableToken: BigNumber;
  totalEarnYieldOn: BigNumber;
  totalEarnYieldOnUSD: BigNumber;
  maxEstimatedAPR: BigNumber;
  surplus: BigNumber;
  isExpanded: boolean;
  emaRate: BigNumber;
  marketRate: BigNumber;
  floatingRatePrediction: BigNumber;
  useMarketRate: boolean;
}
