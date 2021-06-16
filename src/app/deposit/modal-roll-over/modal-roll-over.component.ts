import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { UserDeposit } from '../types';

@Component({
  selector: 'app-modal-roll-over',
  templateUrl: './modal-roll-over.component.html',
  styleUrls: ['./modal-roll-over.component.css'],
})
export class ModalRollOverComponent implements OnInit {
  DEPOSIT_DELAY = 20 * 60; // 20 minutes

  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;

  depositTimeInDays: BigNumber;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    public contract: ContractService
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

  loadData() {
    console.log(this.userDeposit);
    console.log(this.poolInfo);
  }

  resetData() {
    this.depositTimeInDays = new BigNumber(0);
  }

  setDepositTime(timeInDays: number | string): void {
    this.depositTimeInDays = new BigNumber(+timeInDays);
  }

  // @dev needs to be tested with v3 contract
  rollOver() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const maturationTimestamp = this.helpers.processWeb3Number(
      this.depositTimeInDays
        .times(this.constants.DAY_IN_SEC)
        .plus(Date.now() / 1e3)
        .plus(this.DEPOSIT_DELAY)
    );
    const func = pool.methods.rolloverDeposit(
      this.userDeposit.nftID,
      maturationTimestamp
    );

    this.wallet.sendTx(
      func,
      () => {},
      () => {
        this.activeModal.dismiss();
      },
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }
}
