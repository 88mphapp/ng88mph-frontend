import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
    public constants: ConstantsService,
    private router: Router
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

  loadData(): void {
    // load MPH USD price
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    // compute currently withdrawable amount
    const vest = this.userDeposit.vest;
    const depositAmount = this.userDeposit.amountToken;
    let currentWithdrawableAmount;
    const currentTimestamp = Math.min(
      Math.floor(Date.now() / 1e3),
      this.userDeposit.maturationTimestamp
    );
    if (currentTimestamp < vest.lastUpdateTimestamp) {
      currentWithdrawableAmount = vest.accumulatedAmount.minus(
        vest.withdrawnAmount
      );
    } else {
      currentWithdrawableAmount = vest.accumulatedAmount
        .plus(
          depositAmount
            .times(currentTimestamp - vest.lastUpdateTimestamp)
            .times(vest.vestAmountPerStablecoinPerSecond)
        )
        .minus(vest.withdrawnAmount);
    }

    this.fullAmount = vest.totalExpectedMPHAmount;
    this.withdrawnAmount = vest.withdrawnAmount;
    this.currentWithdrawableAmount = currentWithdrawableAmount;
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
    const func = vestContract.methods.withdraw(vest.nftID);

    this.wallet.sendTx(
      func,
      () => {
        this.activeModal.dismiss();
      },
      () => {},
      () => {
        this.router.navigateByUrl('/stake');
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
