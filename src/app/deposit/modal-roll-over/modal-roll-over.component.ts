import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';
import { UserDeposit, AllPool } from '../types';

@Component({
  selector: 'app-modal-roll-over',
  templateUrl: './modal-roll-over.component.html',
  styleUrls: ['./modal-roll-over.component.css'],
})
export class ModalRollOverComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;
  @Input() mphDepositorRewardMintMultiplier: BigNumber;
  @Input() pool: AllPool;

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
  rewardRate: BigNumber;

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

  async loadData() {
    // load the reward rate for the pool
    const vest = this.contract.getNamedContract('Vesting03');
    let rewardRate = new BigNumber(0);
    if (vest.options.address) {
      rewardRate = await vest.methods.rewardRate(this.poolInfo.address).call();
    }
    this.rewardRate = rewardRate;

    this.depositAmountToken = this.userDeposit.amount.plus(
      this.userDeposit.interest
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

    this.helpers
      .getTokenPriceUSD(this.poolInfo.stablecoin, this.wallet.networkID)
      .then((price) => {
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
    this.depositMaturation = new Date(
      Date.now() +
        this.depositTimeInDays
          .times(this.constants.DAY_IN_SEC)
          .times(1e3)
          .toNumber()
    ).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    this.rewardRate = new BigNumber(0);
  }

  async updateAPY() {
    const web3 = this.wallet.httpsWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, web3);

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

    // calculate the reward APR
    const mphAPR = this.rewardRate
      .times(this.constants.YEAR_IN_SEC)
      .times(this.mphPriceUSD)
      .div(this.pool.totalDeposits.plus(this.userDeposit.interest))
      .div(this.stablecoinPriceUSD)
      .times(100);
    this.mphRewardAPR = mphAPR.isNaN() ? new BigNumber(0) : mphAPR;

    // estimate the MPH reward amount for the deposit duration
    const mphAmount = this.rewardRate
      .times(depositTime)
      .times(this.depositAmountToken)
      .div(this.pool.totalDeposits.plus(this.userDeposit.interest));
    this.mphRewardAmountToken = mphAmount.isNaN()
      ? new BigNumber(0)
      : mphAmount;
    this.mphRewardAmountUSD = this.mphRewardAmountToken.times(this.mphPriceUSD);
  }

  setDepositTime(timeInDays: number | string): void {
    this.depositTimeInDays = new BigNumber(+timeInDays);
    if (this.depositTimeInDays.isNaN()) {
      this.depositTimeInDays = new BigNumber(0);
    }
    this.depositMaturation = new Date(
      Date.now() +
        this.depositTimeInDays
          .times(this.constants.DAY_IN_SEC)
          .times(1e3)
          .toNumber()
    ).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
