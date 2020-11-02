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

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.component.html',
  styleUrls: ['./rewards.component.css']
})
export class RewardsComponent implements OnInit {
  stakedMPHBalance: BigNumber;
  stakedMPHPoolProportion: BigNumber;
  claimableRewards: BigNumber;

  constructor(
    private apollo: Apollo,
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService
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
          totalStakedMPHBalance
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));

    const rewards = this.contract.getNamedContract('Rewards');
    this.claimableRewards = new BigNumber(await rewards.methods.earned(this.wallet.userAddress).call()).div(this.constants.PRECISION);
  }

  handleData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      const mphHolder = queryResult.data.mphholder;
      const mph = queryResult.data.mph;
      if (mphHolder) {
        this.stakedMPHBalance = new BigNumber(mphHolder.stakedMPHBalance);
        this.stakedMPHPoolProportion = this.stakedMPHBalance.div(mph.totalStakedMPHBalance).times(100);
        if (this.stakedMPHPoolProportion.isNaN()) {
          this.stakedMPHPoolProportion = new BigNumber(0);
        }
      }
    }
  }

  resetData(): void {
    this.stakedMPHBalance = new BigNumber(0);
    this.stakedMPHPoolProportion = new BigNumber(0);
    this.claimableRewards = new BigNumber(0);
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeComponent, { windowClass: 'fullscreen' });
  }

  unstakeAndClaim() {
    const rewards = this.contract.getNamedContract('Rewards');
    const func = rewards.methods.exit();

    this.wallet.sendTx(func, () => { }, () => { }, console.log);
  }

  claim() {
    const rewards = this.contract.getNamedContract('Rewards');
    const func = rewards.methods.getReward();

    this.wallet.sendTx(func, () => { }, () => { }, console.log);
  }
}

interface QueryResult {
  mphholder: {
    id: string;
    stakedMPHBalance: number;
  };
  mph: {
    totalStakedMPHBalance: number;
  };
}