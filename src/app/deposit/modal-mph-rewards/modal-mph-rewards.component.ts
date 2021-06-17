import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService } from '../../contract.service';
import { UserDeposit, Vest } from '../types';

@Component({
  selector: 'app-modal-mph-rewards',
  templateUrl: './modal-mph-rewards.component.html',
  styleUrls: ['./modal-mph-rewards.component.css'],
})
export class ModalMphRewardsComponent implements OnInit {
  @Input() userDeposit: UserDeposit;

  fullAmount: BigNumber;
  withdrawnAmount: BigNumber;
  currentWithdrawableAmount: BigNumber;
  mphPriceUSD: BigNumber;

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
  }

  // @dev line 61 needs double checked
  loadData(): void {
    // load MPH USD price
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    // calculate vest per stablecoin
    const vest = this.userDeposit.vest;
    const vestAmountPerStablecoinPerSecond = new BigNumber(
      vest.vestAmountPerStablecoinPerSecond
    );
    const depositLength = new BigNumber(this.userDeposit.depositLength);
    const vestAmountPerStablecoin =
      vestAmountPerStablecoinPerSecond.times(depositLength);

    // calculate number of stablecoins in the deposit
    const virtualTokenTotalSupply = new BigNumber(
      this.userDeposit.virtualTokenTotalSupply
    );
    const interestRate = new BigNumber(this.userDeposit.interestRate);
    const depositAmount = virtualTokenTotalSupply.div(
      new BigNumber(1).plus(interestRate)
    );

    this.fullAmount = depositAmount.times(vestAmountPerStablecoin);
    this.withdrawnAmount = new BigNumber(vest.withdrawnAmount);
    this.currentWithdrawableAmount = new BigNumber(vest.accumulatedAmount);
  }

  resetData(): void {
    this.fullAmount = new BigNumber(0);
    this.withdrawnAmount = new BigNumber(0);
    this.currentWithdrawableAmount = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

  // @dev needs to be testing with a live contract
  // @dev withdraw() take a uint64 as a parameter, check to make sure it's correct
  withdraw() {
    const vest = this.userDeposit.vest;
    const vestContract = this.contract.getNamedContract('Vesting02');
    const func = vestContract.methods.withdraw(vest.id);

    this.wallet.sendTx(
      func,
      () => {},
      () => {
        this.loadData();
      },
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  canContinue() {
    return this.wallet.connected && this.currentWithdrawableAmount.gt(0);
  }
}
