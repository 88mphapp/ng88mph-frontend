import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { UserDeposit } from '../types';

@Component({
  selector: 'app-modal-withdraw',
  templateUrl: './modal-withdraw.component.html',
  styleUrls: ['./modal-withdraw.component.css']
})
export class ModalWithdrawComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;
  mphRewardAmount: BigNumber;
  mphTakeBackAmount: BigNumber;
  mphBalance: BigNumber;
  mphPriceUSD: BigNumber;

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
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }

  async loadData() {
    const queryString = gql`
      {
        dpool(id: "${this.poolInfo.address.toLowerCase()}") {
          id
          mphDepositorRewardMultiplier
        }
        mphholder(id: "${this.wallet.userAddress.toLowerCase()}") {
          id
          mphBalance
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => {
      const pool = x.data.dpool;
      const mphholder = x.data.mphholder;

      this.mphRewardAmount = this.userDeposit.mintMPHAmount;
      this.mphTakeBackAmount = this.userDeposit.locked ? this.mphRewardAmount : new BigNumber(1).minus(pool.mphDepositorRewardMultiplier).times(this.mphRewardAmount);

      this.mphBalance = new BigNumber(mphholder.mphBalance);
    });
  }

  resetData() {
    this.mphRewardAmount = new BigNumber(0);
    this.mphTakeBackAmount = new BigNumber(0);
    this.mphBalance = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

  withdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const func = pool.methods.withdraw(this.userDeposit.nftID, this.userDeposit.fundingID);

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  earlyWithdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const func = pool.methods.earlyWithdraw(this.userDeposit.nftID, this.userDeposit.fundingID);

    this.wallet.sendTx(func, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }
}

interface QueryResult {
  dpool: {
    id: string;
    mphDepositorRewardMultiplier: number;
  };
  mphholder: {
    id: string;
    mphBalance: number;
  };
}