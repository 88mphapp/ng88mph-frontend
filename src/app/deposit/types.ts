import BigNumber from 'bignumber.js';
import { PoolInfo, ZeroCouponBondInfo } from '../contract.service';
import { Timer } from '../timer';

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
  totalUserDepositsToken: BigNumber;
  totalUserDepositsUSD: BigNumber;
  mphDepositorRewardMintMultiplier: BigNumber;
}

export interface UserPool {
  poolInfo: PoolInfo;
  deposits: UserDeposit[];
}

export interface UserDeposit {
  nftID: number;
  locked: boolean;
  amountToken: BigNumber;
  amountUSD: BigNumber;
  apy: BigNumber;
  countdownTimer: Timer;
  interestEarnedToken: BigNumber;
  interestEarnedUSD: BigNumber;
  realMPHReward: BigNumber;
  mphAPY: BigNumber;
  virtualTokenTotalSupply: BigNumber;
  vest: Vest;
  depositLength: number;
  interestRate: BigNumber;
  maturationTimestamp: number;
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
  nftID: number;
  lastUpdateTimestamp: number;
  accumulatedAmount: BigNumber;
  withdrawnAmount: BigNumber;
  vestAmountPerStablecoinPerSecond: BigNumber;
}
