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

  buyYieldTokenAmount: BigNumber;
  stablecoinBalance: BigNumber;
  stablecoinPriceUSD: BigNumber;
  youPay: BigNumber;
  earnYieldOn: BigNumber;
  mphRewards: BigNumber;
  mphRewardsAPR: BigNumber;
  totalEarned: BigNumber;
  mphPriceUSD: BigNumber;
  bound: BigNumber;

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
    this.buyYieldTokenAmount = this.deposit.yieldTokensAvailable;

    const stablecoin = this.contract.getPoolStablecoin(this.deposit.pool.name);
    this.stablecoinPriceUSD = new BigNumber(
      await this.helpers.getTokenPriceUSD(this.deposit.pool.stablecoin)
    );
    const stablecoinPrecision = Math.pow(
      10,
      this.deposit.pool.stablecoinDecimals
    );
    stablecoin.methods
      .balanceOf(this.wallet.userAddress)
      .call()
      .then((balance) => {
        this.stablecoinBalance = new BigNumber(balance).div(
          stablecoinPrecision
        );
      });

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    this.updateDetails();
  }

  resetData(): void {
    this.buyYieldTokenAmount = new BigNumber(0);
    this.stablecoinBalance = new BigNumber(0);
    this.stablecoinPriceUSD = new BigNumber(0);
    this.youPay = new BigNumber(0);
    this.earnYieldOn = new BigNumber(0);
    this.mphRewards = new BigNumber(0);
    this.mphRewardsAPR = new BigNumber(0);
    this.totalEarned = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
    this.bound = new BigNumber(0);
  }

  setBuyYieldTokenAmount(amount: number | string) {
    this.buyYieldTokenAmount = new BigNumber(amount);
    if (this.buyYieldTokenAmount.isNaN()) {
      this.buyYieldTokenAmount = new BigNumber(0);
    }
    this.updateDetails();
  }

  async updateDetails() {
    const pool = this.contract.getPool(this.deposit.pool.name);
    const now = Date.now() / 1e3;

    const stablecoinPrecision = Math.pow(
      10,
      this.deposit.pool.stablecoinDecimals
    );
    this.bound = new BigNumber(
      await pool.methods
        .calculateInterestAmount(
          this.helpers.processWeb3Number(
            this.deposit.unfundedDepositAmount.times(stablecoinPrecision)
          ),
          this.helpers.processWeb3Number(this.deposit.maturationTimestamp - now)
        )
        .call()
    ).div(stablecoinPrecision);

    const fundPercent = this.buyYieldTokenAmount.div(
      this.deposit.yieldTokensAvailable
    );

    let fundAmount = fundPercent.times(this.bound);
    if (fundAmount.gt(this.bound)) {
      fundAmount = this.bound;
    }

    this.youPay = fundAmount;
    this.earnYieldOn = fundPercent
      .times(this.deposit.unfundedDepositAmount)
      .plus(fundAmount);

    const depositLength = this.deposit.maturationTimestamp - Date.now() / 1e3;
    const estimatedInterestEarned = this.earnYieldOn.times(
      this.helpers.parseInterestRate(
        this.deposit.pool.oracleInterestRate,
        depositLength
      )
    );
    this.mphRewards = estimatedInterestEarned.times(
      this.deposit.pool.poolFunderRewardMultiplier
    );
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
    const stablecoinPrecision = Math.pow(
      10,
      this.deposit.pool.stablecoinDecimals
    );
    const actualFundAmount = this.helpers.processWeb3Number(
      this.youPay.times(stablecoinPrecision)
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
