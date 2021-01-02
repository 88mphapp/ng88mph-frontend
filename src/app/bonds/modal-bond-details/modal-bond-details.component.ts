import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

@Component({
  selector: 'app-modal-bond-details',
  templateUrl: './modal-bond-details.component.html',
  styleUrls: ['./modal-bond-details.component.css']
})
export class ModalBondDetailsComponent implements OnInit {
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
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }


  resetData() {
    this.mphRewardAmount = new BigNumber(0);
    this.mphTakeBackAmount = new BigNumber(0);
    this.mphBalance = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
  }

}

interface QueryResult {
  dpool: {
    id: string;
    mphDepositorRewardTakeBackMultiplier: number;
  };
}