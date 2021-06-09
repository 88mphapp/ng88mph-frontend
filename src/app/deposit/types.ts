import BigNumber from 'bignumber.js';
import { PoolInfo, ZeroCouponBondInfo } from '../contract.service';
import { Timer } from '../timer';

// v2 DPool
export interface DPool {
  name: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  iconPath: string;
  totalDepositToken: BigNumber;
  totalDepositUSD: BigNumber;
  oneYearInterestRate: BigNumber;
  mphAPY: BigNumber;
  tempMPHAPY: BigNumber;
  totalUserDeposits: BigNumber;
  totalUserDepositsUSD: BigNumber;
}

// v3 DPool
export interface V3DPool {
  name: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  iconPath: string;
  oneYearInterestRate: BigNumber;
  depositorMPHAPR: BigNumber;
  funderMPHAPR: BigNumber;
  totalUserDepositToken: BigNumber;
  totalUserDepositUSD: BigNumber;
}

export interface UserPool {
  poolInfo: PoolInfo;
  deposits: UserDeposit[];
}

export interface UserDeposit {
  nftID: number;
  fundingID: number;
  locked: boolean;
  amountToken: BigNumber;
  amountUSD: BigNumber;
  apy: BigNumber;
  countdownTimer: Timer;
  interestEarnedToken: BigNumber;
  interestEarnedUSD: BigNumber;
  mintMPHAmount: BigNumber;
  realMPHReward: BigNumber;
  mphAPY: BigNumber;
  tempMPHAPY: BigNumber;
  virtualTokenTotalSupply: BigNumber;
  vest: Vest;
  depositLength: number;
  interestRate: BigNumber;
}

// @dev user deposit interface for v3
export interface V3UserDeposit {
  nftID: number;
  virtualTokenTotalSupply: BigNumber;
  interestRate: BigNumber;
  feeRate: BigNumber;
  maturationTimestamp: number;
  depositTimestamp: number;
  depositLength: number;
  averageRecordedIncomeIndex: number;
  fundingInterestPaid: BigNumber;
  fundingRefundPaid: BigNumber;
}

export interface UserZCBPool {
  zcbPoolInfo: ZeroCouponBondInfo;
  poolName: string;
  poolAddress: string;
  amountToken: BigNumber;
  amountUSD: BigNumber;
  maturation: string;
}

// @dev vest interface for v3
export interface Vest {
  id: string;
  lastUpdateTimestamp: BigNumber;
  accumulatedAmount: BigNumber;
  withdrawnAmount: BigNumber;
  vestAmountPerStablecoinPerSecond: BigNumber;
}
