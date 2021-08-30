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
  fundingID: number;
  stablecoinPrice: number;
  funderAccruedInterest: BigNumber;
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
}

export interface FundableDeposit {
  id: string;
  pool: DPool;
  maturationTimestamp: number;
  unfundedDepositAmount: BigNumber;
  unfundedDepositAmountUSD: BigNumber;
  yieldTokensAvailable: BigNumber;
  yieldTokensAvailableUSD: BigNumber;
  estimatedAPR: BigNumber;
  mphRewardsAPR: BigNumber;
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
  poolFunderRewardMultiplier: BigNumber;
}
