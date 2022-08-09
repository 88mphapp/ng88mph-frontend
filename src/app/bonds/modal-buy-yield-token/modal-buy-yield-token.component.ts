import { Component, OnInit, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { DataService } from 'src/app/data.service';
import { FundableDeposit, DPool } from '../interface';

@Component({
  selector: 'app-modal-buy-yield-token',
  templateUrl: './modal-buy-yield-token.component.html',
  styleUrls: ['./modal-buy-yield-token.component.css'],
})
export class ModalBuyYieldTokenComponent implements OnInit {
  @Input() public deposit: FundableDeposit;
  @Input() public pool: DPool;

  stablecoinBalance: BigNumber;
  stablecoinAllowance: BigNumber;
  stablecoinPriceUSD: BigNumber;
  earnYieldOn: BigNumber;
  fundAmount: BigNumber;
  debtAvailable: BigNumber;
  estimatedYield: BigNumber;
  estimatedROI: BigNumber;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService,
    public datas: DataService
  ) {}

  ngOnInit(): void {
    this.resetData();
    this.loadData();
  }

  async loadData() {
    const now = Date.now() / 1e3;
    const web3 = this.wallet.httpsWeb3();
    const pool = this.contract.getPool(this.deposit.pool.name, web3);
    const stablecoin = this.contract.getPoolStablecoin(
      this.deposit.pool.name,
      web3
    );
    const stablecoinPrecision = Math.pow(
      10,
      this.deposit.pool.stablecoinDecimals
    );

    // fetch user balance and allowance
    stablecoin.methods
      .balanceOf(this.wallet.userAddress)
      .call()
      .then((balance) => {
        this.stablecoinBalance = new BigNumber(balance).div(
          stablecoinPrecision
        );
      });
    stablecoin.methods
      .allowance(this.wallet.userAddress, this.deposit.pool.address)
      .call()
      .then((allowance) => {
        this.stablecoinAllowance = new BigNumber(allowance).div(
          stablecoinPrecision
        );
      });

    // fetch stablecoin USD price
    this.stablecoinPriceUSD = new BigNumber(
      await this.datas.getAssetPriceUSD(
        this.deposit.pool.stablecoin,
        this.wallet.networkID
      )
    );

    // fetch amount of debt available
    pool.methods
      .calculateInterestAmount(
        this.helpers.processWeb3Number(
          this.deposit.unfundedDepositAmount.times(stablecoinPrecision)
        ),
        this.helpers.processWeb3Number(this.deposit.maturationTimestamp - now)
      )
      .call()
      .then((bound) => {
        this.debtAvailable = new BigNumber(bound).div(stablecoinPrecision);
        this.setFundAmount(
          this.stablecoinBalance.gte(this.debtAvailable)
            ? this.debtAvailable
            : this.stablecoinBalance
        );
      });
  }

  resetData(): void {
    this.stablecoinBalance = new BigNumber(0);
    this.stablecoinPriceUSD = new BigNumber(0);
    this.earnYieldOn = new BigNumber(0);
    this.fundAmount = new BigNumber(0);
    this.debtAvailable = new BigNumber(0);
    this.estimatedYield = new BigNumber(0);
    this.estimatedROI = new BigNumber(0);
  }

  setFundAmount(amount: number | string | BigNumber) {
    this.fundAmount = new BigNumber(amount);
    if (this.fundAmount.isNaN()) {
      this.fundAmount = new BigNumber(0);
    }
    this.updateDetails();
  }

  presetFundAmount(percent: number) {
    const ratio = new BigNumber(percent).div(100);
    this.fundAmount = this.debtAvailable.times(ratio);
    this.updateDetails();
  }

  updateDetails() {
    let ratio = this.fundAmount.div(this.debtAvailable);
    if (ratio.gte(1)) {
      ratio = new BigNumber(1);
    }

    this.earnYieldOn = this.deposit.unfundedDepositAmount
      .times(ratio)
      .plus(this.fundAmount);

    // estimate yield earned at maturity
    const depositLength = this.deposit.maturationTimestamp - Date.now() / 1e3;
    this.estimatedYield = this.earnYieldOn
      .times(this.pool.floatingRatePrediction)
      .div(100)
      .times(depositLength)
      .div(this.constants.YEAR_IN_SEC);
    this.estimatedROI = this.estimatedYield
      .minus(this.fundAmount)
      .div(this.fundAmount)
      .times(100);
    if (this.estimatedROI.isNaN()) {
      this.estimatedROI = new BigNumber(0);
    }
  }

  updatePoolFloatingRatePrediction(rate: any) {
    this.pool.floatingRatePrediction = new BigNumber(rate);
    this.updateDetails();
  }

  updatePoolFloatingRateType() {
    this.pool.useMarketRate = !this.pool.useMarketRate;
    this.pool.floatingRatePrediction = this.pool.useMarketRate
      ? this.pool.marketRate
      : this.pool.emaRate;
    this.updateDetails();
  }

  approve() {
    const userAddress: string = this.wallet.actualAddress;
    const stablecoin = this.contract.getPoolStablecoin(this.deposit.pool.name);
    const stablecoinPrecision = Math.pow(
      10,
      this.deposit.pool.stablecoinDecimals
    );
    const fundAmount = this.helpers.processWeb3Number(
      this.fundAmount.times(stablecoinPrecision)
    );
    this.wallet.approveToken(
      stablecoin,
      this.deposit.pool.address,
      fundAmount,
      () => {},
      () => {},
      async () => {
        const web3 = this.wallet.httpsWeb3();
        const stablecoin = this.contract.getPoolStablecoin(
          this.deposit.pool.name,
          web3
        );
        await stablecoin.methods
          .allowance(userAddress, this.deposit.pool.address)
          .call()
          .then((result) => {
            this.stablecoinAllowance = new BigNumber(result).div(
              stablecoinPrecision
            );
          });
      },
      (error) => {
        this.wallet.displayGenericError(error);
      },
      true
    );
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
      this.fundAmount.times(stablecoinPrecision)
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
