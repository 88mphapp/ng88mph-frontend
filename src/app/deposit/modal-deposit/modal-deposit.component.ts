import { Component, Input, OnInit } from '@angular/core';
import { gql } from '@apollo/client/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';

@Component({
  selector: 'app-modal-deposit',
  templateUrl: './modal-deposit.component.html',
  styleUrls: ['./modal-deposit.component.css']
})
export class ModalDepositComponent implements OnInit {
  DEPOSIT_DELAY = 20 * 60; // 20 minutes
  DEPOSIT_PERIOD_PRESETS = [7, 14, 30, 60, 90, 180, 365];

  @Input() defaultPoolName: string;

  poolList: PoolInfo[];
  selectedPoolInfo: PoolInfo;
  stablecoinBalance: BigNumber;
  depositAmount: BigNumber;
  depositAmountUSD: BigNumber;
  depositTimeInDays: BigNumber;
  interestAmountToken: BigNumber;
  interestAmountUSD: BigNumber;
  apy: BigNumber;
  mphRewardAmount: BigNumber;
  mphTakeBackAmount: BigNumber;
  minDepositAmount: BigNumber;
  maxDepositAmount: BigNumber;
  minDepositPeriod: number;
  maxDepositPeriod: number;
  mphPriceUSD: BigNumber;
  mphAPY: BigNumber;
  tempMPHAPY: BigNumber;
  mphDepositorRewardMintMultiplier: BigNumber;
  mphDepositorRewardTakeBackMultiplier: BigNumber;

  constructor(
    private apollo: Apollo,
    public activeModal: NgbActiveModal,
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
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
  }

  loadData(): void {
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
    this.poolList = this.contract.getPoolInfoList();
    this.selectPool(this.defaultPoolName ? this.defaultPoolName : this.poolList[0].name);
  }

  resetData(): void {
    this.poolList = [];
    this.stablecoinBalance = new BigNumber(0);
    this.depositTimeInDays = new BigNumber(365);
    this.depositAmount = new BigNumber(0);
    this.depositAmountUSD = new BigNumber(0);
    this.interestAmountToken = new BigNumber(0);
    this.interestAmountUSD = new BigNumber(0);
    this.apy = new BigNumber(0);
    this.mphRewardAmount = new BigNumber(0);
    this.mphTakeBackAmount = new BigNumber(0);
    this.minDepositAmount = new BigNumber(0);
    this.maxDepositAmount = new BigNumber(0);
    this.minDepositPeriod = 0;
    this.maxDepositPeriod = 1e4;
    this.mphPriceUSD = new BigNumber(0);
    this.mphAPY = new BigNumber(0);
    this.tempMPHAPY = new BigNumber(0);
    this.mphDepositorRewardMintMultiplier = new BigNumber(0);
    this.mphDepositorRewardTakeBackMultiplier = new BigNumber(0);
  }

  async selectPool(poolName: string) {
    this.selectedPoolInfo = this.contract.getPoolInfo(poolName);

    const queryString = gql`
      {
        dpool(id: "${this.selectedPoolInfo.address}") {
          id
          MinDepositAmount
          MaxDepositAmount
          MinDepositPeriod
          MaxDepositPeriod
          mphDepositorRewardMintMultiplier
          mphDepositorRewardTakeBackMultiplier
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => {
      const pool = x.data.dpool;
      this.minDepositAmount = new BigNumber(pool.MinDepositAmount);
      this.maxDepositAmount = new BigNumber(pool.MaxDepositAmount);
      this.minDepositPeriod = Math.ceil(pool.MinDepositPeriod / this.constants.DAY_IN_SEC);
      this.maxDepositPeriod = Math.floor(pool.MaxDepositPeriod / this.constants.DAY_IN_SEC);
      this.mphDepositorRewardMintMultiplier = new BigNumber(pool.mphDepositorRewardMintMultiplier);
      this.mphDepositorRewardTakeBackMultiplier = new BigNumber(pool.mphDepositorRewardTakeBackMultiplier);
    });

    if (this.wallet.connected) {
      const stablecoin = this.contract.getPoolStablecoin(poolName);
      const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
      this.stablecoinBalance = new BigNumber(await stablecoin.methods.balanceOf(this.wallet.userAddress).call()).div(stablecoinPrecision);
    }

    this.updateAPY();
  }

  setDepositAmount(amount: string): void {
    this.depositAmount = new BigNumber(+amount);
    this.updateAPY();
  }

  setMaxDepositAmount(): void {
    this.depositAmount = BigNumber.min(this.stablecoinBalance, this.maxDepositAmount);
    this.updateAPY();
  }

  setDepositTime(timeInDays: number | string): void {
    this.depositTimeInDays = new BigNumber(+timeInDays);
    this.updateAPY();
  }

  async updateAPY() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.selectedPoolInfo.name, readonlyWeb3);
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(this.selectedPoolInfo.stablecoin);

    // get deposit amount
    this.depositAmountUSD = new BigNumber(this.depositAmount).times(stablecoinPrice);

    // get interest amount
    const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(stablecoinPrecision));
    const depositTime = this.helpers.processWeb3Number(this.depositTimeInDays.times(this.constants.DAY_IN_SEC));
    const rawInterestAmountToken = new BigNumber(await pool.methods.calculateInterestAmount(depositAmount, depositTime).call()).div(stablecoinPrecision);
    const rawInterestAmountUSD = rawInterestAmountToken.times(stablecoinPrice);
    this.interestAmountToken = this.helpers.applyFeeToInterest(rawInterestAmountToken);
    this.interestAmountUSD = this.helpers.applyFeeToInterest(rawInterestAmountUSD);

    // get APY
    this.apy = this.interestAmountToken.div(this.depositAmount).div(this.depositTimeInDays).times(365).times(100);
    if (this.apy.isNaN()) {
      this.apy = new BigNumber(0);
    }

    // get MPH reward amount
    this.mphRewardAmount = this.mphDepositorRewardMintMultiplier.times(this.depositAmount).times(depositTime);
    this.mphTakeBackAmount = this.mphDepositorRewardTakeBackMultiplier.times(this.mphRewardAmount);

    const mphAPY = this.mphRewardAmount.minus(this.mphTakeBackAmount).times(this.mphPriceUSD).div(this.depositAmountUSD).div(this.depositTimeInDays).times(365).times(100);
    if (mphAPY.isNaN()) {
      this.mphAPY = new BigNumber(0);
    } else {
      this.mphAPY = mphAPY;
    }

    const tempMPHAPY = this.mphRewardAmount.times(this.mphPriceUSD).div(this.depositAmountUSD).div(this.depositTimeInDays).times(365).times(100);
    if (tempMPHAPY.isNaN()) {
      this.tempMPHAPY = new BigNumber(0);
    } else {
      this.tempMPHAPY = tempMPHAPY;
    }    
  }

  deposit() {
    const pool = this.contract.getPool(this.selectedPoolInfo.name);
    const stablecoin = this.contract.getPoolStablecoin(this.selectedPoolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(stablecoinPrecision));
    const maturationTimestamp = this.helpers.processWeb3Number(this.depositTimeInDays.times(this.constants.DAY_IN_SEC).plus(Date.now() / 1e3).plus(this.DEPOSIT_DELAY));
    const func = pool.methods.deposit(depositAmount, maturationTimestamp);

    this.wallet.sendTxWithToken(func, stablecoin, this.selectedPoolInfo.address, depositAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected && this.depositAmount.gte(this.minDepositAmount) && this.depositAmount.lte(this.maxDepositAmount)
      && this.depositTimeInDays.gte(this.minDepositPeriod) && this.depositTimeInDays.lte(this.maxDepositPeriod);
  }
}

interface QueryResult {
  dpool: {
    id: string;
    MinDepositAmount: number;
    MaxDepositAmount: number;
    MinDepositPeriod: number;
    MaxDepositPeriod: number;
    mphDepositorRewardMintMultiplier: number;
    mphDepositorRewardTakeBackMultiplier: number;
  };
}