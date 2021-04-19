import { Component, Input, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ZeroCouponBondTableEntry } from '../../zero-coupon-bonds.component';

@Component({
  selector: 'app-redeem-zero-coupon-bond',
  templateUrl: './redeem-zero-coupon-bond.component.html',
  styleUrls: ['./redeem-zero-coupon-bond.component.css']
})
export class RedeemZeroCouponBondComponent implements OnInit {
  @Input() zcbEntry: ZeroCouponBondTableEntry;
  @Input() poolInfo: PoolInfo;
  now: Date;
  globalRedeemableAmount: BigNumber;

  constructor(
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

  resetData(): void {
    this.now = new Date();
    this.globalRedeemableAmount = new BigNumber(0);
  }

  async loadData() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const stablecoin = this.contract.getPoolStablecoin(this.poolInfo.name, readonlyWeb3);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    stablecoin.methods.balanceOf(this.zcbEntry.zcbInfo.address).call().then(balance => this.globalRedeemableAmount = new BigNumber(balance).div(stablecoinPrecision));
  }

  get zcbIsMature(): boolean {
    return this.now > this.zcbEntry.maturationTimestamp;
  }

  get canContinue(): boolean {
    return this.wallet.connected;
  }

  get maxRedeemableAmount(): BigNumber {
    return BigNumber.min(this.globalRedeemableAmount, this.zcbEntry.userBalance);
  }

  redeem() {
    const zcbContract = this.contract.getZeroCouponBondContract(this.zcbEntry.zcbInfo.address);
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const redeemAmount = BigNumber.min(this.zcbEntry.userBalance, this.globalRedeemableAmount).times(stablecoinPrecision).integerValue().toFixed();
    const func = zcbContract.methods.redeemStablecoin(redeemAmount);

    this.wallet.sendTx(func, () => { }, () => { }, (err) => { this.wallet.displayGenericError(err) });
  }
}
