import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-unstake',
  templateUrl: './modal-unstake.component.html',
  styleUrls: ['./modal-unstake.component.css'],
})
export class ModalUnstakeComponent implements OnInit {
  @Input() xMPHBalance: BigNumber;
  @Input() xMPHTotalSupply: BigNumber;
  @Input() pricePerFullShare: BigNumber;

  unstakeAmount: BigNumber;
  poolProportion: BigNumber;
  newPoolProportion: BigNumber;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    if (this.wallet.connected) {
      this.loadData();
    }
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    this.setUnstakeAmount(this.xMPHBalance.toFixed(18));
  }

  resetData(): void {
    this.unstakeAmount = new BigNumber(0);
    this.poolProportion = new BigNumber(0);
    this.newPoolProportion = new BigNumber(0);
  }

  setUnstakeAmount(amount: number | string) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const xmph = this.contract.getNamedContract('xMPH', readonlyWeb3);

    this.unstakeAmount = new BigNumber(amount);
    if (this.unstakeAmount.isNaN()) {
      this.unstakeAmount = new BigNumber(0);
    }

    this.poolProportion = this.xMPHBalance.div(this.xMPHTotalSupply).times(100);
    this.newPoolProportion = this.xMPHBalance
      .minus(this.unstakeAmount)
      .div(this.xMPHTotalSupply.minus(this.unstakeAmount))
      .times(100);
    if (this.newPoolProportion.isNaN()) {
      this.newPoolProportion = new BigNumber(0);
    }
  }

  // @dev update assets/abis/xMPH.json to correct ABI for xMPH
  // @dev update assets/json/contracts.json to correct address for xMPH
  // @dev update constants.service.ts to correct address for xMPH
  // @dev needs testing once xMPH contract has been deployed on mainnet
  unstake() {
    const xmph = this.contract.getNamedContract('xMPH');
    const unstakeAmount = this.helpers.processWeb3Number(
      this.unstakeAmount.times(this.constants.PRECISION)
    );
    const func = xmph.methods.withdraw(unstakeAmount);

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
    return (
      this.wallet.connected &&
      this.xMPHBalance.gte(this.unstakeAmount) &&
      this.unstakeAmount.gt(0)
    );
  }
}
