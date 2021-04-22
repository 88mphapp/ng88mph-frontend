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
  now: Date;

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    private modalService: NgbModal
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
    if (resetGlobal) {
      this.now = new Date();
    }
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
        totalSupplyUSD: new BigNumber(0),
        userBalance: new BigNumber(0),
        userBalanceUSD: new BigNumber(0),
        maturationTimestamp: new Date(),
        priceInUSD: new BigNumber(0),
        impliedInterestRate: new BigNumber(0),
        mature: false
      }
    });

    const readonlyWeb3 = this.wallet.readonlyWeb3();
    Promise.all(this.selectedPoolZCBList.map(async zcbEntry => {
      const zcbContract = this.contract.getZeroCouponBondContract(zcbEntry.zcbInfo.address, readonlyWeb3);
      const tokenDecimals = this.selectedPoolInfo.stablecoinDecimals;
      const tokenPrecision = Math.pow(10, tokenDecimals);
      zcbEntry.priceInUSD = await this.getZeroCouponBondPriceUSD(zcbEntry.zcbInfo);
      zcbEntry.totalSupply = new BigNumber(await zcbContract.methods.totalSupply().call()).div(tokenPrecision);
      zcbEntry.totalSupplyUSD = zcbEntry.priceInUSD.times(zcbEntry.totalSupply);
      zcbEntry.maturationTimestamp = new Date(+(await zcbContract.methods.maturationTimestamp().call()) * 1e3);
      if (this.wallet.connected && !this.wallet.watching) {
        zcbEntry.userBalance = new BigNumber(await zcbContract.methods.balanceOf(this.wallet.userAddress).call()).div(tokenPrecision);
        zcbEntry.userBalanceUSD = zcbEntry.priceInUSD.times(zcbEntry.userBalance);
      } else if (this.wallet.watching) {
        zcbEntry.userBalance = new BigNumber(await zcbContract.methods.balanceOf(this.wallet.watchedAddress).call()).div(tokenPrecision);
        zcbEntry.userBalanceUSD = zcbEntry.priceInUSD.times(zcbEntry.userBalance);
      }
      zcbEntry.impliedInterestRate = await this.computeImpliedInterestRate(zcbEntry);
      zcbEntry.mature = zcbEntry.maturationTimestamp <= new Date();
      return zcbEntry;
    })).then(zcbList => this.selectedPoolZCBList = zcbList);
  }

  openZCBModal(zcbEntry: ZeroCouponBondTableEntry) {
    const modalRef = this.modalService.open(ModalZeroCouponBondInfoComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.poolInfo = this.selectedPoolInfo;
    modalRef.componentInstance.zcbEntry = zcbEntry;
  }

  async getZeroCouponBondPriceUSD(bond: ZeroCouponBondInfo): Promise<BigNumber> {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pair = this.contract.getContract(bond.sushiSwapPair, 'MPHLP', readonlyWeb3);
    const reservesObj = await pair.methods.getReserves().call();
    if (+reservesObj._reserve0 === 0 || +reservesObj._reserve1 === 0) {
      // no liquidity, return NaN
      return new BigNumber(NaN);
    }
    const baseToken = this.contract.getERC20(bond.sushiSwapPairBaseTokenAddress, readonlyWeb3);
    const baseTokenPrecision = Math.pow(10, +await baseToken.methods.decimals().call());
    let baseTokenReserve;
    let bondReserve;
    if (new BigNumber(bond.sushiSwapPairBaseTokenAddress, 16).lt(new BigNumber(bond.address, 16))) {
      // base token is token0
      baseTokenReserve = new BigNumber(reservesObj._reserve0).div(baseTokenPrecision);
      bondReserve = new BigNumber(reservesObj._reserve1).div(Math.pow(10, this.selectedPoolInfo.stablecoinDecimals));
    } else {
      // base token is token1
      bondReserve = new BigNumber(reservesObj._reserve0).div(Math.pow(10, this.selectedPoolInfo.stablecoinDecimals));
      baseTokenReserve = new BigNumber(reservesObj._reserve1).div(baseTokenPrecision);
    }
    const bondPriceInBaseToken = baseTokenReserve.div(bondReserve);
    const baseTokenPriceInUSD = await this.helpers.getTokenPriceUSD(bond.sushiSwapPairBaseTokenAddress);
    return bondPriceInBaseToken.times(baseTokenPriceInUSD);
  }

  async computeImpliedInterestRate(zcbEntry: ZeroCouponBondTableEntry): Promise<BigNumber> {
    const underlyingPrice = await this.helpers.getTokenPriceUSD(this.selectedPoolInfo.stablecoin);
    const roi = new BigNumber(underlyingPrice).div(zcbEntry.priceInUSD).minus(1);
    const secondsToMaturation = (zcbEntry.maturationTimestamp.getTime() - this.now.getTime()) / 1e3;
    if (secondsToMaturation <= 0) {
      // already mature
      return new BigNumber(NaN);
    }
    const apy = roi.div(secondsToMaturation).times(this.constants.YEAR_IN_SEC).times(100);
    return apy;
  }
}

export interface ZeroCouponBondTableEntry {
  zcbInfo: ZeroCouponBondInfo;
  totalSupply: BigNumber;
  totalSupplyUSD: BigNumber;
  userBalance: BigNumber;
  userBalanceUSD: BigNumber;
  maturationTimestamp: Date;
  priceInUSD: BigNumber;
  impliedInterestRate: BigNumber;
  mature: boolean;
}
