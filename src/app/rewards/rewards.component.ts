import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { ModalStakeComponent } from './modal-stake/modal-stake.component';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.component.html',
  styleUrls: ['./rewards.component.css']
})
export class RewardsComponent implements OnInit {
  PERIOD = 7; // 7 days

  stakedMPHBalance: BigNumber;
  stakedMPHPoolProportion: BigNumber;
  claimableRewards: BigNumber;
  rewardPerWeek: BigNumber;
  totalRewardPerSecond: BigNumber;
  rewardPerMPHPerSecond: BigNumber;
  totalStakedMPHBalance: BigNumber;
  yearlyROI: BigNumber;
  monthlyROI: BigNumber;
  weeklyROI: BigNumber;
  dailyROI: BigNumber;
  mphPriceUSD: BigNumber;

  constructor(
    private apollo: Apollo,
    private modalService: NgbModal,
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
      this.loadData();
    });
    this.wallet.errorEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    const mphHolderID = this.wallet.userAddress.toLowerCase();
    const queryString = gql`
      {
        mphholder(id: "${mphHolderID}") {
          id
          stakedMPHBalance
        }
        mph(id: "0") {
          id
          totalStakedMPHBalance
          rewardPerMPHPerSecond
          rewardPerSecond
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));

    const rewards = this.contract.getNamedContract('Rewards');
    this.claimableRewards = new BigNumber(await rewards.methods.earned(this.wallet.userAddress).call()).div(this.constants.PRECISION);
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const mph = queryResult.data.mph;
      this.totalStakedMPHBalance = new BigNumber(mph.totalStakedMPHBalance);
      this.rewardPerMPHPerSecond = new BigNumber(mph.rewardPerMPHPerSecond);

      const mphHolder = queryResult.data.mphholder;
      if (mphHolder) {
        this.stakedMPHBalance = new BigNumber(mphHolder.stakedMPHBalance);
        this.stakedMPHPoolProportion = this.stakedMPHBalance.div(mph.totalStakedMPHBalance).times(100);
        if (this.stakedMPHPoolProportion.isNaN()) {
          this.stakedMPHPoolProportion = new BigNumber(0);
        }
        const weekInSeconds = 7 * 24 * 60 * 60;
        this.rewardPerWeek = this.stakedMPHBalance.times(this.rewardPerMPHPerSecond).times(weekInSeconds);
      }

      this.totalRewardPerSecond = new BigNumber(mph.rewardPerSecond);
      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();
      const secondROI = this.totalRewardPerSecond.div(this.totalStakedMPHBalance.times(this.mphPriceUSD)).times(100);
      this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
      this.monthlyROI = secondROI.times(this.constants.MONTH_IN_SEC);
      this.weeklyROI = secondROI.times(this.constants.WEEK_IN_SEC);
      this.dailyROI = secondROI.times(this.constants.DAY_IN_SEC);
    }
  }

  resetData(): void {
    this.stakedMPHBalance = new BigNumber(0);
    this.stakedMPHPoolProportion = new BigNumber(0);
    this.claimableRewards = new BigNumber(0);
    this.totalStakedMPHBalance = new BigNumber(0);
    this.rewardPerMPHPerSecond = new BigNumber(0);
    this.rewardPerWeek = new BigNumber(0);
    this.totalRewardPerSecond = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
    this.yearlyROI = new BigNumber(0);
    this.monthlyROI = new BigNumber(0);
    this.weeklyROI = new BigNumber(0);
    this.dailyROI = new BigNumber(0);
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeComponent, { windowClass: 'fullscreen' });
    modalRef.componentInstance.stakedMPHPoolProportion = this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance = this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerWeek = this.rewardPerWeek;
  }

  unstakeAndClaim() {
    const rewards = this.contract.getNamedContract('Rewards');
    const func = rewards.methods.exit();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  claim() {
    const rewards = this.contract.getNamedContract('Rewards');
    const func = rewards.methods.getReward();

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }

  canContinue() {
    return this.wallet.connected;
  }
}

interface QueryResult {
  mphholder: {
    id: string;
    stakedMPHBalance: number;
  };
  mph: {
    id: string;
    totalStakedMPHBalance: number;
    rewardPerMPHPerSecond: number;
    rewardPerSecond: number;
  };
}