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
    this.currentWithdrawableAmount = this.userDeposit.reward;
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }

  resetData(): void {
    this.currentWithdrawableAmount = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

  withdraw() {
    const vest = this.userDeposit.vest;
    const vestContract = this.contract.getNamedContract('Vesting03');
    const func = vestContract.methods.withdraw(vest.nftID);

    this.wallet.sendTx(
      func,
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

  canContinue() {
    return this.wallet.connected && this.currentWithdrawableAmount.gt(0);
  }
}
