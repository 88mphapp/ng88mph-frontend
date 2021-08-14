import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { DPool } from 'src/app/bonds/interface';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { UserDeposit } from '../types';

@Component({
  selector: 'app-modal-roll-over',
  templateUrl: './modal-roll-over.component.html',
  styleUrls: ['./modal-roll-over.component.css'],
})
export class ModalRollOverComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;
  @Input() mphDepositorRewardMintMultiplier: BigNumber;
  @Input() dpool: DPool;

  depositAmountToken: BigNumber;
  depositAmountUSD: BigNumber;
  depositTimeInDays: BigNumber;

  mphPriceUSD: BigNumber;
  stablecoinPriceUSD: BigNumber;
  interestRate: BigNumber;
  interestAmountToken: BigNumber;
  interestAmountUSD: BigNumber;
  mphRewardAmountToken: BigNumber;
  mphRewardAmountUSD: BigNumber;
  mphRewardAPR: BigNumber;
  depositMaturation: string;
  maxDepositPeriodInDays: number;

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    public contract: ContractService
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
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData();
      this.loadData();
    });
  }

  loadData() {
    this.depositAmountToken = this.userDeposit.amountToken.plus(
      this.userDeposit.interestEarnedToken
    );

    const queryString = gql`
      {
        dpool(id: "${this.poolInfo.address.toLowerCase()}") {
          id
          MaxDepositPeriod
        }
      }
    `;
    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => {
      const pool = data.dpool;
      this.maxDepositPeriodInDays = Math.floor(
        +pool.MaxDepositPeriod / this.constants.DAY_IN_SEC
      );
    });

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    this.helpers.getTokenPriceUSD(this.poolInfo.stablecoin).then((price) => {
      this.stablecoinPriceUSD = new BigNumber(price);
      this.updateAPY();
    });
  }

  resetData() {
    this.depositAmountToken = new BigNumber(0);
    this.depositAmountUSD = new BigNumber(0);
    this.depositTimeInDays = new BigNumber(30);

    this.mphPriceUSD = new BigNumber(0);
    this.stablecoinPriceUSD = new BigNumber(0);
    this.interestRate = new BigNumber(0);
    this.interestAmountToken = new BigNumber(0);
    this.interestAmountUSD = new BigNumber(0);
    this.mphRewardAmountToken = new BigNumber(0);
    this.mphRewardAmountUSD = new BigNumber(0);
    this.mphRewardAPR = new BigNumber(0);
    this.depositMaturation = new Date(Date.now()).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async updateAPY() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, readonlyWeb3);

    // get deposit amount
    this.depositAmountUSD = new BigNumber(this.depositAmountToken).times(
      this.stablecoinPriceUSD
    );

    // get interest amount
    const stablecoinPrecision = Math.pow(10, this.poolInfo.stablecoinDecimals);
    const depositAmountToken = this.helpers.processWeb3Number(
      this.depositAmountToken.times(stablecoinPrecision)
    );
    const depositTime = this.helpers.processWeb3Number(
      this.depositTimeInDays.times(this.constants.DAY_IN_SEC)
    );
    const rawInterestAmountToken = new BigNumber(
      await pool.methods
        .calculateInterestAmount(depositAmountToken, depositTime)
        .call()
    );
    const interestAmountToken = new BigNumber(
      await this.helpers.applyFeeToInterest(
        rawInterestAmountToken,
        this.poolInfo
      )
    );

    this.interestAmountToken = new BigNumber(interestAmountToken).div(
      stablecoinPrecision
    );
    this.interestAmountUSD = new BigNumber(interestAmountToken)
      .div(stablecoinPrecision)
      .times(this.stablecoinPriceUSD);

    // get APR
    this.interestRate = interestAmountToken
      .div(depositAmountToken)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (this.interestRate.isNaN()) {
      this.interestRate = new BigNumber(0);
    }

    // get MPH reward amount
    this.mphRewardAmountToken = this.mphDepositorRewardMintMultiplier
      .times(this.depositAmountToken)
      .times(depositTime);
    this.mphRewardAmountUSD = this.mphRewardAmountToken.times(this.mphPriceUSD);

    const mphAPY = this.mphRewardAmountToken
      .times(this.mphPriceUSD)
      .div(this.depositAmountUSD)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (mphAPY.isNaN()) {
      this.mphRewardAPR = new BigNumber(0);
    } else {
      this.mphRewardAPR = mphAPY;
    }
  }

  setDepositTime(timeInDays: number | string): void {
    this.depositTimeInDays = new BigNumber(+timeInDays);
    if (this.depositTimeInDays.isNaN()) {
      this.depositTimeInDays = new BigNumber(0);
    }
    this.updateAPY();
  }

  rollOver() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const maturationTimestamp = this.helpers.processWeb3Number(
      this.depositTimeInDays
        .times(this.constants.DAY_IN_SEC)
        .plus(Date.now() / 1e3)
    );
    const func = pool.methods.rolloverDeposit(
      this.userDeposit.nftID,
      maturationTimestamp
    );

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
}

interface QueryResult {
  dpool: {
    id: string;
    MaxDepositPeriod: string;
  };
}
