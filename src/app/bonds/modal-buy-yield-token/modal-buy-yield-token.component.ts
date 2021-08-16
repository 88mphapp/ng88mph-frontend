import { Component, OnInit, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { FundableDeposit } from '../interface';

@Component({
  selector: 'app-modal-buy-yield-token',
  templateUrl: './modal-buy-yield-token.component.html',
  styleUrls: ['./modal-buy-yield-token.component.css'],
})
export class ModalBuyYieldTokenComponent implements OnInit {
  @Input() public deposit: FundableDeposit;

  fundAmount: BigNumber;
  stablecoinBalance: BigNumber;
  stablecoinPriceUSD: BigNumber;
  youPay: BigNumber;
  earnYieldOn: BigNumber;
  mphRewards: BigNumber;
  mphRewardsAPR: BigNumber;
  totalEarned: BigNumber;
  mphPriceUSD: BigNumber;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.fundAmount = this.deposit.yieldTokensAvailable;

    const stablecoin = this.contract.getPoolStablecoin(this.deposit.pool.name);
    this.stablecoinPriceUSD = new BigNumber(
      await this.helpers.getTokenPriceUSD(this.deposit.pool.stablecoin)
    );
    stablecoin.methods
      .balanceOf(this.wallet.userAddress)
      .call()
      .then((balance) => {
        this.stablecoinBalance = new BigNumber(balance).div(
          this.constants.PRECISION
        );
      });

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    this.updateDetails();
  }

  resetData(): void {
    this.fundAmount = new BigNumber(0);
    this.stablecoinBalance = new BigNumber(0);
    this.stablecoinPriceUSD = new BigNumber(0);
    this.youPay = new BigNumber(0);
    this.earnYieldOn = new BigNumber(0);
    this.mphRewards = new BigNumber(0);
    this.mphRewardsAPR = new BigNumber(0);
    this.totalEarned = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

  setFundAmount(amount: number | string) {
    this.fundAmount = new BigNumber(amount);
    if (this.fundAmount.isNaN()) {
      this.fundAmount = new BigNumber(0);
    }
    this.updateDetails();
  }

  async updateDetails() {
    console.log(this.deposit);
    const lens = this.contract.getNamedContract('DInterestLens');
    const depositID = this.deposit.id.split('---')[1];

    let surplusMagnitude;
    await lens.methods
      .surplusOfDeposit(this.deposit.pool.address, depositID)
      .call()
      .then((result) => {
        surplusMagnitude = new BigNumber(result.surplusAmount).div(
          this.constants.PRECISION
        );
      });

    const fundPercent = this.fundAmount.div(this.deposit.yieldTokensAvailable);

    let fundAmount = this.fundAmount.minus(
      fundPercent.times(this.deposit.unfundedDepositAmount)
    );
    if (fundAmount.gt(surplusMagnitude)) {
      fundAmount = surplusMagnitude;
    }

    this.youPay = fundAmount;
    this.earnYieldOn = fundPercent
      .times(this.deposit.unfundedDepositAmount)
      .plus(fundAmount);

    const depositLength = this.deposit.maturationTimestamp - Date.now() / 1e3;
    const estimatedInterestEarned = this.earnYieldOn
      .times(this.deposit.pool.oracleInterestRate)
      .div(100)
      .div(this.constants.YEAR_IN_SEC)
      .times(depositLength);
    this.mphRewards = estimatedInterestEarned
      .times(Math.pow(10, this.deposit.pool.stablecoinDecimals))
      .times(this.deposit.pool.poolFunderRewardMultiplier)
      .div(this.constants.PRECISION);
    this.mphRewardsAPR = this.mphRewards
      .times(this.mphPriceUSD)
      .div(fundAmount.times(this.stablecoinPriceUSD))
      .times(100);
    this.totalEarned = estimatedInterestEarned
      .times(this.stablecoinPriceUSD)
      .plus(this.mphRewards.times(this.mphPriceUSD));
  }

  async buyYieldTokens() {
    const pool = this.contract.getPool(this.deposit.pool.name);
    const stablecoin = this.contract.getPoolStablecoin(this.deposit.pool.name);
    const depositID = this.deposit.id.split('---')[1];
    const actualFundAmount = this.helpers.processWeb3Number(
      this.youPay.times(this.constants.PRECISION)
    );
    const func = pool.methods.fund(depositID, actualFundAmount);

    this.wallet.sendTxWithToken(
      func,
      stablecoin,
      this.deposit.pool.address,
      actualFundAmount,
      () => {
        this.activeModal.dismiss();
      },
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }
}
