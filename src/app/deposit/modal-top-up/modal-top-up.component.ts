import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { UserPool, UserDeposit } from '../types';

@Component({
  selector: 'app-modal-top-up',
  templateUrl: './modal-top-up.component.html',
  styleUrls: ['./modal-top-up.component.css']
})
export class ModalTopUpComponent implements OnInit {

  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;

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

  loadData(): void {
    console.log(this.userDeposit);
    console.log(this.poolInfo);
  }

  resetData(): void {

  }

  canContinue() {

  }

}
