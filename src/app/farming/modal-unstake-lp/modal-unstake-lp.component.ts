import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-unstake-lp',
  templateUrl: './modal-unstake-lp.component.html',
  styleUrls: ['./modal-unstake-lp.component.css'],
})
export class ModalUnstakeLPComponent implements OnInit {
  @Input() selectedPool: string;
  @Input() bancorSelectedToken: string;
  @Input() bancorTokens: Array<string>;
  @Input() stakedMPHPoolProportion: BigNumber;
  @Input() stakedMPHBalance: BigNumber;
  @Input() totalStakedMPHBalance: BigNumber;
  @Input() totalRewardPerSecond: BigNumber;
  @Input() rewardPerDay: BigNumber;
  @Input() mphPriceUSD: BigNumber;
  @Input() sushiStakedLPBalance: BigNumber;
  @Input() bancorStakedMPHBalance: BigNumber;
  @Input() bancorStakedBNTBalance: BigNumber;
  @Input() bancorMPHDeposits: Array<BigNumber>;
  @Input() bancorBNTDeposits: Array<BigNumber>;

  stakedAmount: BigNumber;
  unstakeAmount: BigNumber;
  bancorSelectedDeposit: BigNumber;
  newStakedMPHPoolProportion: BigNumber;
  newRewardPerDay: BigNumber;

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
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData();
      this.loadData();
    });
  }

  async loadData() {
    if (this.selectedPool === 'Uniswap v2') {
      this.setUnstakeAmount(this.stakedMPHBalance.toFixed(18));
      this.stakedAmount = this.stakedMPHBalance;
    } else if (this.selectedPool === 'SushiSwap') {
      this.setUnstakeAmount(this.sushiStakedLPBalance.toFixed(18));
      this.stakedAmount = this.sushiStakedLPBalance;
    } else if (this.selectedPool === 'Bancor') {
      let pool = this.contract.getNamedContract('BancorLP');
      if (this.bancorSelectedToken === 'MPH') {
        this.bancorSelectedDeposit = this.bancorMPHDeposits[0];
        this.getClaimAmount();
      } else if (this.bancorSelectedToken === 'BNT') {
        this.bancorSelectedDeposit = this.bancorBNTDeposits[0];
        this.getClaimAmount();
      }
    }
  }

  resetData(): void {
    this.stakedAmount = new BigNumber(0);
    this.unstakeAmount = new BigNumber(0);
    this.bancorSelectedDeposit = new BigNumber(0);
    this.newStakedMPHPoolProportion = new BigNumber(0);
    this.newRewardPerDay = new BigNumber(0);
  }

  async getClaimAmount() {
    let pool = this.contract.getNamedContract('BancorLP');
    if (this.bancorSelectedDeposit !== undefined) {
      let poolDeposit = await pool.methods
        .removeLiquidityReturn(this.bancorSelectedDeposit, 1000000, Date.now())
        .call();
      let claimAmount = new BigNumber(poolDeposit[1]).div(
        this.constants.PRECISION
      );
      this.setUnstakeAmount(claimAmount.toFixed(18));
      this.stakedAmount = claimAmount;
    } else {
      this.setUnstakeAmount(0);
      this.stakedAmount = new BigNumber(0);
    }
  }

  setUnstakeAmount(amount: number | string) {
    this.unstakeAmount = new BigNumber(amount);
    if (this.unstakeAmount.isNaN()) {
      this.unstakeAmount = new BigNumber(0);
    }
    this.newStakedMPHPoolProportion = this.stakedMPHBalance
      .minus(this.unstakeAmount)
      .div(this.totalStakedMPHBalance.minus(this.unstakeAmount))
      .times(100);
    if (this.newStakedMPHPoolProportion.isNaN()) {
      this.newStakedMPHPoolProportion = new BigNumber(0);
    }
    this.newRewardPerDay = this.stakedMPHBalance
      .minus(this.unstakeAmount)
      .times(
        this.totalRewardPerSecond.div(
          this.totalStakedMPHBalance.minus(this.unstakeAmount)
        )
      )
      .times(this.constants.DAY_IN_SEC);
    if (this.newRewardPerDay.isNaN()) {
      this.newRewardPerDay = new BigNumber(0);
    }
  }

  unstake() {
    const unstakeAmount = this.helpers.processWeb3Number(
      this.unstakeAmount.times(this.constants.PRECISION)
    );
    let rewards;
    let func;
    const address = this.wallet.actualAddress;

    if (this.selectedPool === 'Uniswap v2') {
      rewards = this.contract.getNamedContract('Farming');
      func = rewards.methods.withdraw(unstakeAmount);
    } else if (this.selectedPool === 'SushiSwap') {
      rewards = this.contract.getContract(
        this.constants.SUSHI_MASTERCHEF_V2[this.wallet.networkID],
        'MasterChefV2'
      );
      func = rewards.methods.withdrawAndHarvest(
        this.constants.SUSHI_MPH_REWARDER_ID[this.wallet.networkID],
        unstakeAmount,
        address
      );
    } else if (this.selectedPool === 'Bancor') {
      rewards = this.contract.getNamedContract('BancorLP');
      if (this.bancorSelectedToken === 'MPH') {
        let portion = this.unstakeAmount.div(this.stakedAmount).times(1000000);
        func = rewards.methods.removeLiquidity(
          this.bancorSelectedDeposit,
          this.helpers.processWeb3Number(portion)
        );
        console.log(func);
      } else if (this.bancorSelectedToken === 'BNT') {
        let portion = this.unstakeAmount.div(this.stakedAmount).times(1000000);
        func = rewards.methods.removeLiquidity(
          this.bancorSelectedDeposit,
          this.helpers.processWeb3Number(portion)
        );
      }
    }

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
      this.unstakeAmount.gt(0) &&
      this.unstakeAmount.lte(this.stakedAmount)
    );
  }
}
