import { Component, Input, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-stake',
  templateUrl: './modal-stake.component.html',
  styleUrls: ['./modal-stake.component.css']
})
export class ModalStakeComponent implements OnInit {
  @Input() stakedMPHPoolProportion: BigNumber;
  @Input() stakedMPHBalance: BigNumber;
  @Input() totalStakedMPHBalance: BigNumber;
  @Input() rewardPerMPHPerSecond: BigNumber;
  @Input() rewardPerWeek: BigNumber;
  mphBalance: BigNumber;
  stakeAmount: BigNumber;
  newStakedMPHPoolProportion: BigNumber;
  newRewardPerWeek: BigNumber;

  constructor(
    private apollo: Apollo,
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    const mphHolderID = this.wallet.userAddress.toLowerCase();
    const queryString = gql`
      {
        mphholder(id: "${mphHolderID}") {
          id
          mphBalance
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));
  }

  handleData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      const mphHolder = queryResult.data.mphholder;
      if (mphHolder) {
        this.mphBalance = new BigNumber(mphHolder.mphBalance);
        this.stakeAmount = this.mphBalance;
      }
    }
  }

  resetData(): void {
    this.mphBalance = new BigNumber(0);
    this.stakeAmount = new BigNumber(0);
    this.newStakedMPHPoolProportion = new BigNumber(0);
    this.newRewardPerWeek = new BigNumber(0);
  }

  setStakeAmount(amount: number | string) {
    this.stakeAmount = new BigNumber(+amount);
    this.newStakedMPHPoolProportion = this.stakedMPHBalance.plus(this.stakeAmount).div(this.totalStakedMPHBalance).times(100);
    if (this.newStakedMPHPoolProportion.isNaN()) {
      this.newStakedMPHPoolProportion = new BigNumber(0);
    }
    const weekInSeconds = 7 * 24 * 60 * 60;
    this.newRewardPerWeek = this.stakedMPHBalance.plus(this.stakeAmount).times(this.rewardPerMPHPerSecond).times(weekInSeconds);
  }

  stake() {
    const rewards = this.contract.getNamedContract('Rewards');
    const stakeAmount = this.helpers.processWeb3Number(this.stakeAmount.times(this.constants.PRECISION));
    const func = rewards.methods.stake(stakeAmount);

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }
}

interface QueryResult {
  mphholder: {
    id: string;
    mphBalance: number;
  };
}