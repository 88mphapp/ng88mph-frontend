import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConstantsService } from '../constants.service';
import { ContractService, PoolInfo, ZeroCouponBondInfo } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';
import { ModalZeroCouponBondInfoComponent } from './modal-zero-coupon-bond-info/modal-zero-coupon-bond-info.component';

@Component({
  selector: 'app-zero-coupon-bonds',
  templateUrl: './zero-coupon-bonds.component.html',
  styleUrls: ['./zero-coupon-bonds.component.css']
})
export class ZeroCouponBondsComponent implements OnInit {
  allPoolList: PoolInfo[];
  selectedPoolInfo: PoolInfo;
  selectedPoolZCBList: ZeroCouponBondInfo[];

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    private modalService: NgbModal
  ) { }

  ngOnInit(): void {
    const zcbPoolNameList = this.contract.getZeroCouponBondPoolNameList();
    this.allPoolList = zcbPoolNameList.map(poolName => this.contract.getPoolInfo(poolName));
    this.selectPool(0);
  }

  selectPool(poolIdx: number) {
    this.selectedPoolInfo = this.allPoolList[poolIdx];
    this.selectedPoolZCBList = this.contract.getZeroCouponBondPool(this.selectedPoolInfo.name);
  }

  openZCBModal(zcbInfo: ZeroCouponBondInfo) {
    const modalRef = this.modalService.open(ModalZeroCouponBondInfoComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.poolInfo = this.selectedPoolInfo;
    modalRef.componentInstance.zcbInfo = zcbInfo;
  }
}
