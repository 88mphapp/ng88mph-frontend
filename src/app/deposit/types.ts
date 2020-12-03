import BigNumber from 'bignumber.js';
import { PoolInfo } from '../contract.service';
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
  tempMPHAPY: BigNumber;
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
}