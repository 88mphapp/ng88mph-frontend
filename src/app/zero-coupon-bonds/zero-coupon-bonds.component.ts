import { Component, OnInit } from '@angular/core';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-zero-coupon-bonds',
  templateUrl: './zero-coupon-bonds.component.html',
  styleUrls: ['./zero-coupon-bonds.component.css']
})
export class ZeroCouponBondsComponent implements OnInit {

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
  ) { }

  ngOnInit(): void {
  }

  selectPool(poolIdx: number) {

  }
}
