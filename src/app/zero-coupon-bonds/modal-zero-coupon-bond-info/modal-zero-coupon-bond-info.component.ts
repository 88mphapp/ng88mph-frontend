import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo, ZeroCouponBondInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-zero-coupon-bond-info',
  templateUrl: './modal-zero-coupon-bond-info.component.html',
  styleUrls: ['./modal-zero-coupon-bond-info.component.css']
})
export class ModalZeroCouponBondInfoComponent implements OnInit {
  @Input() zcbInfo: ZeroCouponBondInfo;
  @Input() poolInfo: PoolInfo;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {

  }

  loadData(loadUser: boolean, loadGlobal: boolean): void {

  }
}
