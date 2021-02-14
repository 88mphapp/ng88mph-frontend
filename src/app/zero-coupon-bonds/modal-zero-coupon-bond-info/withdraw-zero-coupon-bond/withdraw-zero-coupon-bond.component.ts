import { Component, Input, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import BigNumber from 'bignumber.js';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { ZeroCouponBondTableEntry } from '../../zero-coupon-bonds.component';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';

const mockData = {
  fractionalDeposits: [
    {
      id: '0x1234',
      address: '0x1234',
      deposit: {
        nftID: 1,
        fundingID: 3,
        amount: 100,
        interestEarned: 10,
        mintMPHAmount: 10
      }
    }
  ],
  dpool: {
    mphDepositorRewardTakeBackMultiplier: 0.3
  }
}

@Component({
  selector: 'app-withdraw-zero-coupon-bond',
  templateUrl: './withdraw-zero-coupon-bond.component.html',
  styleUrls: ['./withdraw-zero-coupon-bond.component.css']
})
export class WithdrawZeroCouponBondComponent implements OnInit {
  @Input() zcbEntry: ZeroCouponBondTableEntry;
  @Input() poolInfo: PoolInfo;
  DECIMALS = 2;
  mphPriceUSD: BigNumber;
  stablecoinPriceUSD: BigNumber;
  activeDeposits: FractionalDeposit[];
  now: Date;

  constructor(
    private apollo: Apollo,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
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
  }

  resetData(): void {
    this.mphPriceUSD = new BigNumber(0);
    this.stablecoinPriceUSD = new BigNumber(0);
    this.activeDeposits = [];
    this.now = new Date();
  }

  async loadData() {
    await this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    this.helpers.getTokenPriceUSD(this.poolInfo.stablecoin).then(price => this.stablecoinPriceUSD = new BigNumber(price));

    if (this.wallet.connected) {
      this.loadActiveDeposits(false);
    }
  }

  loadActiveDeposits(showAllDeposits: boolean) {
    const userID = this.wallet.userAddress.toLowerCase();
    const zeroCouponBondID = this.zcbEntry.zcbInfo.address.toLowerCase();
    const poolID = this.poolInfo.address.toLowerCase();
    let queryString;
    if (showAllDeposits) {
      queryString = gql`
        {
          fractionalDeposits(where: { active: true, zeroCouponBondAddress: "${zeroCouponBondID}" }) {
            id
            address
            deposit {
              nftID
              fundingID
              amount
              interestEarned
              mintMPHAmount
            }
          }
          dpool(id: "${poolID}") {
            id
            mphDepositorRewardTakeBackMultiplier
          }
        }
      `;
    } else {
      queryString = gql`
        {
          fractionalDeposits(where: { active: true, ownerAddress: "${userID}", zeroCouponBondAddress: "${zeroCouponBondID}" }) {
            id
            address
            deposit {
              nftID
              fundingID
              amount
              interestEarned
              mintMPHAmount
            }
          }
          dpool(id: "${poolID}") {
            id
            mphDepositorRewardTakeBackMultiplier
          }
        }
      `;
    }

    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const fractionalDeposits = queryResult.data.fractionalDeposits;
      const pool = queryResult.data.dpool;

      if (pool && fractionalDeposits) {
        const mphDepositorRewardTakeBackMultiplier = new BigNumber(pool.mphDepositorRewardTakeBackMultiplier);
        const parsedDeposits: FractionalDeposit[] = [];
        for (const rawDeposit of fractionalDeposits) {
          const interestEarnedToken = this.helpers.applyFeeToInterest(rawDeposit.deposit.interestEarned, this.poolInfo);
          const realMPHReward = new BigNumber(1).minus(mphDepositorRewardTakeBackMultiplier).times(rawDeposit.deposit.mintMPHAmount);
          const parsedDeposit: FractionalDeposit = {
            address: rawDeposit.address,
            nftID: +rawDeposit.deposit.nftID,
            fundingID: +rawDeposit.deposit.fundingID,
            unlockStablecoinAmount: new BigNumber(rawDeposit.deposit.amount).plus(interestEarnedToken),
            unlockMPHAmount: realMPHReward
          };
          parsedDeposits.push(parsedDeposit);
        }
        this.activeDeposits = parsedDeposits;
      }
    }
  }

  canContinue(): boolean {
    return this.wallet.connected && this.now > this.zcbEntry.maturationTimestamp;
  }

  withdraw(deposit: FractionalDeposit) {
    const zeroCouponBondContract = this.contract.getZeroCouponBondContract(this.zcbEntry.zcbInfo.address);
    const func = zeroCouponBondContract.methods.redeemFractionalDepositShares(deposit.address, deposit.fundingID);
    this.wallet.sendTx(func, () => { }, () => { }, (err) => { this.wallet.displayGenericError(err) });
  }
}

interface QueryResult {
  fractionalDeposits: {
    id: string;
    address: string;
    deposit: {
      nftID: number;
      fundingID: number;
      amount: number;
      interestEarned: number;
      mintMPHAmount: number;
    }
  }[];
  dpool: {
    id: string;
    mphDepositorRewardTakeBackMultiplier: number;
  };
}

interface FractionalDeposit {
  address: string;
  nftID: number;
  fundingID: number;
  unlockStablecoinAmount: BigNumber;
  unlockMPHAmount: BigNumber;
}