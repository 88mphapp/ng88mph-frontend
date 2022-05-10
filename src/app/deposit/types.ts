import BigNumber from 'bignumber.js';
import { PoolInfo, ZeroCouponBondInfo } from '../contract.service';

export interface AllPool {
  // general
  name: string;
  address: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  iconPath: string;
  poolInfo: PoolInfo;
  isExpanded: boolean;

  // global
  mphDepositorRewardMintMultiplier: BigNumber;
  totalDepositsUSD: BigNumber;
  totalDeposits: BigNumber;
  maxAPR: BigNumber;
  mphAPR: BigNumber;
  isBest: boolean;

  // user
  userDeposits: UserDeposit[];
  userTotalDeposit: BigNumber;
  userTotalDepositUSD: BigNumber;
}

export interface GlobalPool {
  address: string;
  stablecoin: string;
  mphDepositorRewardMintMultiplier: BigNumber;
  totalDepositsUSD: BigNumber;
  totalDeposits: BigNumber;
  maxAPR: BigNumber;
  mphAPR: BigNumber;
  isBest: boolean;
}

export interface UserPool {
  address: string;
  userDeposits: UserDeposit[];
  userTotalDeposit: BigNumber;
  userTotalDepositUSD: BigNumber;
}

export interface UserDeposit {
  nftID: number;
  amount: BigNumber;
  amountUSD: BigNumber;
  interest: BigNumber;
  interestUSD: BigNumber;
  interestAPR: BigNumber;
  reward: BigNumber;
  rewardUSD: BigNumber;
  rewardAPR: BigNumber;
  virtualTokenTotalSupply: BigNumber;
  depositLength: number;
  maturation: number;
  locked: boolean;
  vest: Vest;
}

export interface Vest {
  nftID: number;
  lastUpdateTimestamp: number;
  accumulatedAmount: BigNumber;
  withdrawnAmount: BigNumber;
  vestAmountPerStablecoinPerSecond: BigNumber;
  totalExpectedMPHAmount: BigNumber;
}

export interface UserZCBPool {
  zcbPoolInfo: ZeroCouponBondInfo;
  poolInfo: PoolInfo;
  amountToken: BigNumber;
  amountUSD: BigNumber;
  maturation: string;
  locked: boolean;
}
