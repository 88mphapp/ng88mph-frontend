import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { DPool, UserPool, UserDeposit } from '../types';

@Component({
  selector: 'app-modal-top-up',
  templateUrl: './modal-top-up.component.html',
  styleUrls: ['./modal-top-up.component.css']
})
export class ModalTopUpComponent implements OnInit {

  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;

  depositAmountToken: BigNumber;
  depositAmountUSD: BigNumber;
  depositTokenBalance: BigNumber;

  mphPriceUSD: BigNumber;
  interestRate: BigNumber;
  interestAmountToken: BigNumber;
  interestAmountUSD: BigNumber;
  mphRewardAmountToken: BigNumber;
  mphRewardAmountUSD: BigNumber;
  mphRewardAPR: BigNumber;
  depositMaturation: string;

  constructor(
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

  async loadData() {
    let address;
    if (this.wallet.connected && !this.wallet.watching) {
      address = this.wallet.userAddress.toLowerCase();
    } else if (this.wallet.watching) {
      address = this.wallet.watchedAddress.toLowerCase();
    }

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    const stablecoin = this.contract.getPoolStablecoin(this.poolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    this.depositTokenBalance = new BigNumber(await stablecoin.methods.balanceOf(address).call()).div(stablecoinPrecision);

    this.updateAPY();
  }

  resetData(): void {
    this.depositAmountToken = new BigNumber(0);
    this.depositAmountUSD = new BigNumber(0);
    this.depositTokenBalance = new BigNumber(0);

    this.mphPriceUSD = new BigNumber(0);
    this.interestRate = new BigNumber(0);
    this.interestAmountToken = new BigNumber(0);
    this.interestAmountUSD = new BigNumber(0);
    this.mphRewardAmountToken = new BigNumber(0);
    this.mphRewardAmountUSD = new BigNumber(0);
    this.mphRewardAPR = new BigNumber(0);
    this.depositMaturation = new Date(Date.now()).toLocaleString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
  }

  async updateAPY() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, readonlyWeb3);
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(this.poolInfo.stablecoin);

    // calculate deposit amount
    this.depositAmountUSD = new BigNumber(this.depositAmountToken).times(stablecoinPrice);

    // @dev remaining todos
    // 1- update interest amounts
    // 2- update mph reward amounts and apr
    // 3- update fixed-interest rate
    // 4- update maturity date
  }

  setDepositAmount(amount: string) {
    this.depositAmountToken = new BigNumber(+amount);
    this.updateAPY();
  }

  setMaxDepositAmount() {
    this.depositAmountToken = this.depositTokenBalance;
    this.updateAPY();
  }

  // @dev needs to be tested with a v3 contract
  deposit() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const stablecoin = this.contract.getPoolStablecoin(this.poolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(this.depositAmountToken.times(stablecoinPrecision));
    const func = pool.methods.topUpDeposit(this.userDeposit.nftID, depositAmount);

    this.wallet.sendTxWithToken(func, stablecoin, this.poolInfo.address, depositAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected
      && this.depositAmountToken.gt(0)
      && this.depositAmountToken.lte(this.depositTokenBalance)
    ;
  }

}
