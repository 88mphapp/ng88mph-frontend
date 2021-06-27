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

  loadData(): void {
    this.fundAmount = this.deposit.yieldTokensAvailable;

    const stablecoin = this.contract.getPoolStablecoin(this.deposit.pool.name);
    stablecoin.methods
      .balanceOf(this.wallet.userAddress)
      .call()
      .then((balance) => {
        this.stablecoinBalance = new BigNumber(balance).div(
          this.constants.PRECISION
        );
      });
  }

  resetData(): void {
    this.fundAmount = new BigNumber(0);
    this.stablecoinBalance = new BigNumber(0);
  }

  setFundAmount(amount: number | string) {
    this.fundAmount = new BigNumber(amount);
    if (this.fundAmount.isNaN()) {
      this.fundAmount = new BigNumber(0);
    }
  }

  async buyYieldTokens() {
    const pool = this.contract.getPool(this.deposit.pool.name);
    const lens = this.contract.getNamedContract('DInterestLens');
    const stablecoin = this.contract.getPoolStablecoin(this.deposit.pool.name);
    const depositID = this.deposit.id.split('---')[1];

    // let surplusMagnitude;
    // await pool.methods
    //   .rawSurplusOfDeposit(depositID)
    //   .call()
    //   .then((result) => {
    //     surplusMagnitude = new BigNumber(result.surplusAmount).div(this.constants.PRECISION);
    //   });
    // console.log(surplusMagnitude.toString());

    let surplusMagnitude;
    await lens.methods
      .surplusOfDeposit(this.deposit.pool.address, depositID)
      .call()
      .then((result) => {
        surplusMagnitude = new BigNumber(result.surplusAmount).div(
          this.constants.PRECISION
        );
      });
    console.log(surplusMagnitude.toString());

    //console.log(this.fundAmount.toString());
    //console.log(this.deposit.yieldTokensAvailable.toString());

    const fundPercent = this.fundAmount.div(this.deposit.yieldTokensAvailable);
    let fundAmount = this.fundAmount.minus(
      fundPercent.times(this.deposit.unfundedDepositAmount)
    );
    console.log(fundAmount.toString());
    // if fund amount is larger than surplus magnitude, then use the surplus magnitude
    if (fundAmount.gt(surplusMagnitude)) {
      fundAmount = surplusMagnitude;
    }
    console.log(fundAmount.toString());

    const actualFundAmount = this.helpers.processWeb3Number(
      fundAmount.times(this.constants.PRECISION)
    );
    console.log(actualFundAmount);
    const func = pool.methods.fund(depositID, actualFundAmount);
    console.log(func);

    const received = this.deposit.yieldTokensAvailable
      .times(fundAmount)
      .div(surplusMagnitude);
    console.log(received.toString());

    this.wallet.sendTxWithToken(
      func,
      stablecoin,
      this.deposit.pool.address,
      actualFundAmount,
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }
}
