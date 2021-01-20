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
          mphDepositorRewardTakeBackMultiplier
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => {
      const pool = x.data.dpool;

      if (pool) {
        this.mphRewardAmount = this.userDeposit.mintMPHAmount;
        this.mphTakeBackAmount = this.userDeposit.locked ? this.mphRewardAmount : new BigNumber(pool.mphDepositorRewardTakeBackMultiplier).times(this.mphRewardAmount);
      }
    });

    const mphToken = this.contract.getNamedContract('MPHToken', this.wallet.readonlyWeb3());
    this.mphBalance = new BigNumber(await mphToken.methods.balanceOf(this.wallet.userAddress).call()).div(this.constants.PRECISION);
  }

  resetData() {
    this.mphRewardAmount = new BigNumber(0);
    this.mphTakeBackAmount = new BigNumber(0);
    this.mphBalance = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

  withdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const mphToken = this.contract.getNamedContract('MPHToken');
    const mphMinter = this.contract.getNamedContractAddress('MPHMinter');
    const mphAmount = this.helpers.processWeb3Number(this.mphTakeBackAmount.times(this.constants.PRECISION));
    const func = pool.methods.withdraw(this.userDeposit.nftID, this.userDeposit.fundingID);

    this.wallet.sendTxWithToken(func, mphToken, mphMinter, mphAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  earlyWithdraw() {
    const pool = this.contract.getPool(this.poolInfo.name);
    const mphToken = this.contract.getNamedContract('MPHToken');
    const mphMinter = this.contract.getNamedContractAddress('MPHMinter');
    const mphAmount = this.helpers.processWeb3Number(this.mphTakeBackAmount.times(this.constants.PRECISION));
    const func = pool.methods.earlyWithdraw(this.userDeposit.nftID, this.userDeposit.fundingID);

    this.wallet.sendTxWithToken(func, mphToken, mphMinter, mphAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }
}

interface QueryResult {
  dpool: {
    id: string;
    mphDepositorRewardTakeBackMultiplier: number;
  };
}