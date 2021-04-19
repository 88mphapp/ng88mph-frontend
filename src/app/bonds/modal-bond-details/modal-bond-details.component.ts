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
  deposits: Deposit[];
  roi: string;
  floatingRatePrediction: BigNumber;
  estimatedROI: BigNumber;
  estimatedProfitUSD: BigNumber;
  estimatedProfitToken: BigNumber;
  totalAmountMulTime: BigNumber;
  interestFromLeftoverDeposits: BigNumber;
  totalMPHReward: BigNumber;
  @Input() public funderPool: FunderPool;
  @Input() public funding: Funding;
  @Input() public mphPriceUSD: BigNumber;

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

  loadData(): void {
    const { nftID, pool, interestEarnedUSD, deficitUSD, refundAmountUSD } = this.funding;
    this.roi = interestEarnedUSD.minus(deficitUSD.minus(refundAmountUSD)).div(deficitUSD.minus(refundAmountUSD)).times(100).toFormat(2);
    const queryString = gql`
      {
        deposits(where: { fundingID: "${nftID}", pool: "${pool.address.toLowerCase()}" }, orderBy: maturationTimestamp) {
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
      const now = Date.now() / 1e3;

      let newDeposits: Array<Deposit> = [];
      let newTotalAmountMulTime = new BigNumber(0);
      let newTotalMPHReward = new BigNumber(0);
      for (const deposit of deposits) {
        const mphRewardTimeComponent = this.funding.creationTimestamp < deposit.maturationTimestamp ? deposit.maturationTimestamp - this.funding.creationTimestamp : 0;
        const funderMPHReward = new BigNumber(deposit.amount).times(this.funding.pool.mphFunderRewardMultiplier).times(mphRewardTimeComponent);
        const depositObj: Deposit = {
          ...deposit,
          maturationTimestamp: +deposit.maturationTimestamp,
          amount: new BigNumber(deposit.amount),
          fundingInterestPaid: new BigNumber(deposit.fundingInterestPaid),
          fundingRefundAmount: new BigNumber(deposit.fundingRefundAmount),
          funderMPHReward
        };
        newDeposits = [...newDeposits, depositObj];
        newTotalMPHReward = newTotalMPHReward.plus(funderMPHReward);

        if (depositObj.active) {
          if (depositObj.maturationTimestamp > now) {
            newTotalAmountMulTime = newTotalAmountMulTime.plus(depositObj.amount.times(depositObj.maturationTimestamp - now));
          } else {
            // mature but not withdrawn, compute current interest accumulated
            const interestAccumulated = depositObj.amount.times(this.funding.pool.moneyMarketIncomeIndex).div(this.funding.recordedMoneyMarketIncomeIndex).minus(depositObj.amount);
            this.interestFromLeftoverDeposits = this.interestFromLeftoverDeposits.plus(interestAccumulated);
          }
        }
      }

      this.deposits = newDeposits;
      this.totalAmountMulTime = newTotalAmountMulTime;
      this.totalMPHReward = newTotalMPHReward;
      this.updateFloatingRatePrediction(this.funding.pool.oracleInterestRate);
    }
  }

  resetData(): void {
    this.deposits = [];
    this.floatingRatePrediction = new BigNumber(0);
    this.estimatedProfitToken = new BigNumber(0);
    this.estimatedProfitUSD = new BigNumber(0);
    this.estimatedROI = new BigNumber(0);
    this.totalAmountMulTime = new BigNumber(0);
    this.interestFromLeftoverDeposits = new BigNumber(0);
    this.totalMPHReward = new BigNumber(0);
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleDateString();
  }

  updateFloatingRatePrediction(newPrediction: any) {
    this.floatingRatePrediction = new BigNumber(newPrediction);
    const estimatedRemainingEarnings = this.totalAmountMulTime.times(newPrediction).div(100).div(this.constants.YEAR_IN_SEC);
    const cost = this.funding.deficitToken.minus(this.funding.refundAmountToken);
    this.estimatedProfitToken = estimatedRemainingEarnings.plus(this.funding.interestEarnedToken).plus(this.interestFromLeftoverDeposits).minus(cost);
    const tokenPrice = this.funding.deficitUSD.div(this.funding.deficitToken); // infer token price from funding, avoids network request
    this.estimatedProfitUSD = this.estimatedProfitToken.times(tokenPrice);
    this.estimatedROI = this.estimatedProfitToken.div(cost).times(100);
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
  funderMPHReward: BigNumber;
}

interface FundingDepositResult {
  deposits: Deposit[];
}
