import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { FundedDeposit } from '../interface';

@Component({
  selector: 'app-modal-withdraw-yield-token-interest',
  templateUrl: './modal-withdraw-yield-token-interest.component.html',
  styleUrls: ['./modal-withdraw-yield-token-interest.component.css'],
})
export class ModalWithdrawYieldTokenInterestComponent implements OnInit {
  @Input() poolInfo: PoolInfo;
  @Input() fundedDeposit: FundedDeposit;
  @Input() mphPriceUSD: BigNumber;

  withdrawableInterestToken: BigNumber;
  withdrawableInterestUSD: BigNumber;
  withdrawableMPHToken: BigNumber;
  withdrawableMPHUSD: BigNumber;

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
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData();
      this.loadData();
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      setTimeout(() => {
        this.resetData();
        this.loadData();
      }, this.constants.TX_CONFIRMATION_REFRESH_WAIT_TIME);
    });
  }

  loadData(): void {
    // fetch withdrwableInterest
    this.fundedDeposit.yieldToken.methods
      .dividendOf(
        this.fundedDeposit.fundingID,
        this.poolInfo.stablecoin,
        this.wallet.actualAddress
      )
      .call()
      .then((withdrawableInterest) => {
        this.withdrawableInterestToken = new BigNumber(
          withdrawableInterest
        ).div(Math.pow(10, this.poolInfo.stablecoinDecimals));
        this.withdrawableInterestUSD = this.withdrawableInterestToken.times(
          this.fundedDeposit.stablecoinPrice
        );
      });

    // fetch withdrawableMPH
    this.fundedDeposit.yieldToken.methods
      .dividendOf(
        this.fundedDeposit.fundingID,
        this.constants.MPH_ADDRESS[this.wallet.networkID],
        this.wallet.actualAddress
      )
      .call()
      .then((withdrawableMPH) => {
        this.withdrawableMPHToken = new BigNumber(withdrawableMPH).div(
          this.constants.PRECISION
        );
        this.withdrawableMPHUSD = this.withdrawableMPHToken.times(
          this.mphPriceUSD
        );
      });
  }

  resetData(): void {
    this.withdrawableInterestToken = new BigNumber(0);
    this.withdrawableInterestUSD = new BigNumber(0);
    this.withdrawableMPHToken = new BigNumber(0);
    this.withdrawableMPHUSD = new BigNumber(0);
  }

  withdrawInterest(): void {
    this.withdraw(this.poolInfo.stablecoin);
  }

  withdrawMPH(): void {
    this.withdraw(this.constants.MPH_ADDRESS[this.wallet.networkID]);
  }

  private withdraw(dividendToken: string): void {
    const func = this.fundedDeposit.yieldToken.methods.withdrawDividend(
      this.fundedDeposit.fundingID,
      dividendToken
    );
    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  handleAccruedInterest(): void {
    const pool = this.contract.getPool(this.poolInfo.name);
    const func = pool.methods.payInterestToFunders(
      this.fundedDeposit.fundingID
    );
    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      () => {
        this.fundedDeposit.funderAccruedInterest = new BigNumber(0);
      },
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  canContinue() {
    return this.wallet.connected;
  }
}
