import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ZeroCouponBondTableEntry } from '../zero-coupon-bonds.component';

@Component({
  selector: 'app-modal-zero-coupon-bond-info',
  templateUrl: './modal-zero-coupon-bond-info.component.html',
  styleUrls: ['./modal-zero-coupon-bond-info.component.css']
})
export class ModalZeroCouponBondInfoComponent implements OnInit {
  @Input() zcbEntry: ZeroCouponBondTableEntry;
  @Input() poolInfo: PoolInfo;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
  ) {
  }

  ngOnInit(): void {

  }
}
