import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';

@Component({
  selector: 'app-modal-deposit',
  templateUrl: './modal-deposit.component.html',
  styleUrls: ['./modal-deposit.component.css']
})
export class ModalDepositComponent implements OnInit {
  PRECISION = 1e18;
  DAY = 24 * 60 * 60;
  DEPOSIT_DELAY = 60 * 60; // 1 hour

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

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
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
  }

  async selectPool(poolName: string) {
    this.selectedPoolInfo = this.contract.getPoolInfo(poolName);
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

  setDepositTime(timeInDays: number | string): void {
    this.depositTimeInDays = new BigNumber(+timeInDays);
    this.updateAPY();
  }

  async updateAPY() {
    const pool = this.contract.getPool(this.selectedPoolInfo.name);
    const mphMinter = this.contract.getNamedContract('MPHMinter');
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(this.selectedPoolInfo.stablecoin);

    // get deposit amount
    this.depositAmountUSD = new BigNumber(this.depositAmount).times(stablecoinPrice);

    // get interest amount
    const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(stablecoinPrecision));
    const depositTime = this.helpers.processWeb3Number(this.depositTimeInDays.times(this.DAY));
    this.interestAmountToken = new BigNumber(await pool.methods.calculateInterestAmount(depositAmount, depositTime).call()).div(stablecoinPrecision);
    this.interestAmountUSD = this.interestAmountToken.times(stablecoinPrice);

    // get APY
    this.apy = this.interestAmountToken.div(this.depositAmount).div(this.depositTimeInDays).times(365).times(100);
    if (this.apy.isNaN()) {
      this.apy = new BigNumber(0);
    }

    // get MPH reward amount
    const poolMintingMultiplier = new BigNumber(await mphMinter.methods.poolMintingMultiplier(this.selectedPoolInfo.address).call()).div(this.PRECISION);
    const poolDepositorRewardMultiplier = new BigNumber(await mphMinter.methods.poolDepositorRewardMultiplier(this.selectedPoolInfo.address).call()).div(this.PRECISION);
    this.mphRewardAmount = poolMintingMultiplier.times(this.depositAmount);
    this.mphTakeBackAmount = new BigNumber(1).minus(poolDepositorRewardMultiplier).times(this.mphRewardAmount);
  }

  deposit() {
    const pool = this.contract.getPool(this.selectedPoolInfo.name);
    const stablecoin = this.contract.getPoolStablecoin(this.selectedPoolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(stablecoinPrecision));
    const maturationTimestamp = this.helpers.processWeb3Number(this.depositTimeInDays.times(this.DAY).plus(Date.now() / 1e3).plus(this.DEPOSIT_DELAY));
    const func = pool.methods.deposit(depositAmount, maturationTimestamp);

    this.wallet.sendTxWithToken(func, stablecoin, this.selectedPoolInfo.address, depositAmount, () => { }, () => { this.activeModal.dismiss() }, console.log);
  }
}
