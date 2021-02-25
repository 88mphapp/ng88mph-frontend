import { Component, Input, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ZeroCouponBondTableEntry } from '../../zero-coupon-bonds.component';

@Component({
  selector: 'app-mint-zero-coupon-bond',
  templateUrl: './mint-zero-coupon-bond.component.html',
  styleUrls: ['./mint-zero-coupon-bond.component.css']
})
export class MintZeroCouponBondComponent implements OnInit {
  @Input() zcbEntry: ZeroCouponBondTableEntry;
  @Input() poolInfo: PoolInfo;
  DECIMALS = 2;
  mphPriceUSD: BigNumber;
  eligibleDeposits: UserDeposit[];
  mphBalance: BigNumber;

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
    this.eligibleDeposits = [];
    this.mphBalance = new BigNumber(0);
  }

  async loadData() {
    if (!this.wallet.connected) {
      return;
    }

    await this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });

    const mphContract = this.contract.getNamedContract('MPHToken');
    mphContract.methods.balanceOf(this.wallet.userAddress).call().then((balance) => this.mphBalance = new BigNumber(balance).div(this.constants.PRECISION));

    const maturationTimestamp = Math.floor(this.zcbEntry.maturationTimestamp.getTime() / 1e3);

    const userID = this.wallet.userAddress.toLowerCase();
    const queryString = gql`
      {
        deposits(where: { pool: "${this.poolInfo.address.toLowerCase()}", user: "${userID}", active: true, maturationTimestamp_lte: "${maturationTimestamp}" }, orderBy: nftID) {
          nftID
          amount
          depositTimestamp
          maturationTimestamp
          interestEarned
          mintMPHAmount
        }
        dpool(id: "${this.poolInfo.address.toLowerCase()}") {
          mphDepositorRewardTakeBackMultiplier
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const deposits = queryResult.data.deposits;
      const pool = queryResult.data.dpool;
      if (deposits && pool) {
        let stablecoinPriceCache = {};
        const stablecoin = this.poolInfo.stablecoin.toLowerCase();
        let stablecoinPrice = stablecoinPriceCache[stablecoin];
        if (!stablecoinPrice) {
          stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
          stablecoinPriceCache[stablecoin] = stablecoinPrice;
        }
        const userPoolDeposits: Array<UserDeposit> = [];
        for (const deposit of deposits) {
          // compute MPH APY
          let mphDepositorRewardTakeBackMultiplier = new BigNumber(pool.mphDepositorRewardTakeBackMultiplier);
          const realMPHReward = new BigNumber(1).minus(mphDepositorRewardTakeBackMultiplier).times(deposit.mintMPHAmount);

          // compute interest
          const interestEarnedToken = this.helpers.applyFeeToInterest(deposit.interestEarned, this.poolInfo);
          const interestEarnedUSD = interestEarnedToken.times(stablecoinPrice);

          const userPoolDeposit: UserDeposit = {
            nftID: deposit.nftID,
            amountToken: new BigNumber(deposit.amount),
            amountUSD: new BigNumber(deposit.amount).times(stablecoinPrice),
            apy: interestEarnedToken.div(deposit.amount).div(deposit.maturationTimestamp - deposit.depositTimestamp).times(this.constants.YEAR_IN_SEC).times(100),
            maturationDate: new Date(+deposit.maturationTimestamp * 1e3).toLocaleString(),
            interestEarnedToken,
            interestEarnedUSD,
            mintMPHAmount: new BigNumber(deposit.mintMPHAmount),
            realMPHReward: realMPHReward,
            mintableZCBAmount: new BigNumber(deposit.amount).plus(interestEarnedToken)
          }
          userPoolDeposits.push(userPoolDeposit);
        }
        this.eligibleDeposits = userPoolDeposits;
      }
    }
  }

  async mint(deposit: UserDeposit) {
    const poolContract = this.contract.getPool(this.poolInfo.name);
    const zcbContract = this.contract.getZeroCouponBondContract(this.zcbEntry.zcbInfo.address);
    const mphContract = this.contract.getNamedContract('MPHToken');
    const depositNFTAddress = await poolContract.methods.depositNFT().call();
    const depositNFTContract = this.contract.getContract(depositNFTAddress, 'NFT');

    const fractionalDepositName = `88mph Fractional Deposit`;
    const fractionalDepositSymbol = `88MPH-FD`;
    const mphDepositAmount = deposit.mintMPHAmount.times(this.constants.PRECISION).integerValue().toFixed();
    const mintFunc = zcbContract.methods.mintWithDepositNFT(deposit.nftID, fractionalDepositName, fractionalDepositSymbol);

    // approve deposit NFT
    const approvedForNFT = (await depositNFTContract.methods.getApproved(deposit.nftID).call() !== this.constants.ZERO_ADDR);
    const approvedForAll = await depositNFTContract.methods.isApprovedForAll(this.wallet.userAddress, this.zcbEntry.zcbInfo.address).call();
    if (!approvedForAll && !approvedForNFT) {
      // need approval
      const approveFunc = depositNFTContract.methods.setApprovalForAll(this.zcbEntry.zcbInfo.address, true);
      this.wallet.sendTx(approveFunc, () => { }, () => {
        // mint with deposit NFT
        this.wallet.sendTxWithToken(mintFunc, mphContract, this.zcbEntry.zcbInfo.address, mphDepositAmount, () => { }, () => { }, (err) => { this.wallet.displayGenericError(err) })
      }, (err) => { this.wallet.displayGenericError(err) });
      return;
    }

    // mint with deposit NFT
    this.wallet.sendTxWithToken(mintFunc, mphContract, this.zcbEntry.zcbInfo.address, mphDepositAmount, () => { }, () => { }, (err) => { this.wallet.displayGenericError(err) })
  }

  canContinue(deposit: UserDeposit) {
    return this.wallet.connected && this.mphBalance.gte(deposit.mintMPHAmount);
  }
}

interface QueryResult {
  deposits: {
    nftID: number;
    amount: number;
    depositTimestamp: number;
    maturationTimestamp: number;
    interestEarned: number;
    mintMPHAmount: number;
  }[];
  dpool: {
    mphDepositorRewardTakeBackMultiplier: number;
  }
}

interface UserDeposit {
  nftID: number;
  amountToken: BigNumber;
  amountUSD: BigNumber;
  apy: BigNumber;
  maturationDate: string;
  interestEarnedToken: BigNumber;
  interestEarnedUSD: BigNumber;
  mintMPHAmount: BigNumber;
  realMPHReward: BigNumber;
  mintableZCBAmount: BigNumber;
}