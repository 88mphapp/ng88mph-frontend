import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo, gql } from 'apollo-angular';
import { ApolloQueryResult } from '@apollo/client/core';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { FunderPool, Funding } from '../interface';

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
  deposits: Deposit[];
  roi: string;
  @Input() public funderPool: FunderPool;
  @Input() public funding: Funding;

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

  loadData(): void {
    const { fromDepositID, toDepositID, pool, interestEarnedUSD, deficitUSD, refundAmountUSD } = this.funding;
    this.roi = interestEarnedUSD.minus(deficitUSD.minus(refundAmountUSD)).div(deficitUSD.minus(refundAmountUSD)).times(100).toFormat(2);
    const queryString = gql`
      {
        deposits(where: { nftID_gt : ${fromDepositID}, nftID_lte : ${toDepositID}, pool: "${pool.address.toLowerCase()}" }, orderBy: maturationTimestamp) {
          amount
          maturationTimestamp
          depositTimestamp
          interestEarned
          mintMPHAmount
          takeBackMPHAmount
          initialMoneyMarketIncomeIndex
          fundingInterestPaid
          fundingRefundAmount
          active
        }
      }
    `;
    this.apollo.query<FundingDepositResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));
  }

  async handleData(queryResult: ApolloQueryResult<FundingDepositResult>): Promise<void> {
    if (!queryResult.loading) {
      const { deposits } = queryResult.data;

      let newDeposits: Array<Deposit> = [];
      for (const deposit of deposits) {
        const depositObj: Deposit = {
          ...deposit,
          amount: new BigNumber(deposit.amount),
          fundingInterestPaid: new BigNumber(deposit.fundingInterestPaid),
          fundingRefundAmount: new BigNumber(deposit.fundingRefundAmount),
        };
        newDeposits = [...newDeposits, depositObj];
      }

      this.deposits = newDeposits;
    }
  }


  resetData(): void {
    this.mphRewardAmount = new BigNumber(0);
    this.mphTakeBackAmount = new BigNumber(0);
    this.mphBalance = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
    this.deposits = [];
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleDateString();
  }
}

interface Deposit {
  amount: BigNumber;
  maturationTimestamp: number;
  depositTimestamp: number;
  interestEarned: BigNumber;
  mintMPHAmount: BigNumber;
  takeBackMPHAmount: BigNumber;
  initialMoneyMarketIncomeIndex: BigNumber;
  fundingInterestPaid: BigNumber;
  fundingRefundAmount: BigNumber;
  active: boolean;
}

interface FundingDepositResult {
  deposits: Deposit[];
}
