import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
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
  selectedPoolZCBList: ZeroCouponBondTableEntry[];

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    private modalService: NgbModal
  ) { }

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
    if (loadGlobal) {
      const zcbPoolNameList = this.contract.getZeroCouponBondPoolNameList();
      this.allPoolList = zcbPoolNameList.map(poolName => this.contract.getPoolInfo(poolName));
      this.selectPool(0);
    }
  }

  selectPool(poolIdx: number) {
    this.selectedPoolInfo = this.allPoolList[poolIdx];
    this.selectedPoolZCBList = this.contract.getZeroCouponBondPool(this.selectedPoolInfo.name).map(zcbInfo => {
      return {
        zcbInfo,
        totalSupply: new BigNumber(0),
        userBalance: new BigNumber(0),
        maturationTimestamp: new Date()
      }
    });

    const readonlyWeb3 = this.wallet.readonlyWeb3();
    Promise.all(this.selectedPoolZCBList.map(async zcbEntry => {
      const zcbContract = this.contract.getZeroCouponBondContract(zcbEntry.zcbInfo.address, readonlyWeb3);
      const tokenDecimals = this.selectedPoolInfo.stablecoinDecimals;
      const tokenPrecision = Math.pow(10, tokenDecimals);
      zcbEntry.totalSupply = new BigNumber(await zcbContract.methods.totalSupply().call()).div(tokenPrecision);
      zcbEntry.maturationTimestamp = new Date(+(await zcbContract.methods.maturationTimestamp().call()) * 1e3);
      if (this.wallet.connected) {
        zcbEntry.userBalance = new BigNumber(await zcbContract.methods.balanceOf(this.wallet.userAddress).call()).div(tokenPrecision);
      }
      return zcbEntry;
    })).then(zcbList => this.selectedPoolZCBList = zcbList);
  }

  openZCBModal(zcbEntry: ZeroCouponBondTableEntry) {
    const modalRef = this.modalService.open(ModalZeroCouponBondInfoComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.poolInfo = this.selectedPoolInfo;
    modalRef.componentInstance.zcbEntry = zcbEntry;
  }
}

export interface ZeroCouponBondTableEntry {
  zcbInfo: ZeroCouponBondInfo;
  totalSupply: BigNumber;
  userBalance: BigNumber;
  maturationTimestamp: Date;
}