import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { Timer } from '../timer';
import { WalletService } from '../wallet.service';

const mockData = [
  {
    id: '0xc0FcF8403e10B65f1D18f1B81b093004B1127275---0',
    amount: 123.45,
    vestPeriodInSeconds: 7 * 24 * 60 * 60,
    creationTimestamp: 1606183067,
    withdrawnAmount: 100,
  },
  {
    id: '0xc0FcF8403e10B65f1D18f1B81b093004B1127275---1',
    amount: 3123.45,
    vestPeriodInSeconds: 10 * 24 * 60 * 60,
    creationTimestamp: 1605297600,
    withdrawnAmount: 20,
  }
];

@Component({
  selector: 'app-vesting',
  templateUrl: './vesting.component.html',
  styleUrls: ['./vesting.component.css']
})
export class VestingComponent implements OnInit {
  mphPriceUSD: BigNumber;
  vestList: Vest[];
  now: number;

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
    if (this.wallet.connected || this.wallet.watching) {
      this.loadData();
    }
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    //const userID = this.wallet.userAddress.toLowerCase();
    let userID;
    if (this.wallet.connected && !this.wallet.watching) {
      userID = this.wallet.userAddress.toLowerCase();
    } else if (this.wallet.watching) {
      userID = this.wallet.watchedAddress.toLowerCase();
    } else {
      userID = '';
    }
    const queryString = gql`
      {
        vests(where: { user: "${userID}" }, orderBy: creationTimestamp, orderDirection: desc, first: 1000) {
          id
          amount
          vestPeriodInSeconds
          creationTimestamp
          withdrawnAmount
        }
      }
    `

    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }

  async handleData(queryResult: ApolloQueryResult<QueryResult>) {
    if (!queryResult.loading) {
      const vests = queryResult.data.vests;

      this.now = Date.now() / 1e3;

      if (vests) {
        const vestList = [];
        for (let vest of vests) {
          const fullyVestTimestamp = +vest.creationTimestamp + +vest.vestPeriodInSeconds;
          const vestObj: Vest = {
            id: vest.id,
            amount: new BigNumber(vest.amount),
            vestPeriodInSeconds: +vest.vestPeriodInSeconds,
            creationTimestamp: +vest.creationTimestamp,
            withdrawnAmount: new BigNumber(vest.withdrawnAmount),
            countdownTimer: new Timer(fullyVestTimestamp, 'down'),
            locked: this.now < fullyVestTimestamp
          };
          vestObj.countdownTimer.start();
          vestList.push(vestObj);
        }
        this.vestList = vestList;
      }
    }
  }

  resetData() {
    this.mphPriceUSD = new BigNumber(0);
    this.vestList = [];
    this.now = 0;
  }

  getCurrentWithdrawableAmount(vest: Vest): BigNumber {
    if (vest.locked) {
      // partially vested
      return vest.amount.times(this.now - vest.creationTimestamp).div(vest.vestPeriodInSeconds).minus(vest.withdrawnAmount);
    } else {
      // fully vested
      return vest.amount.minus(vest.withdrawnAmount);
    }
  }

  getIdxOfVest(vest: Vest): number {
    // TODO: hack, change later
    return +(vest.id.split('---')[1]);
  }

  withdraw(vest: Vest) {
    const vesting = this.contract.getNamedContract('Vesting');
    const func = vesting.methods.withdrawVested(this.wallet.userAddress, this.getIdxOfVest(vest));

    this.wallet.sendTx(func, () => { }, () => { this.loadData(); }, (error) => { this.wallet.displayGenericError(error) });
  }
}

interface QueryResult {
  vests: {
    id: string;
    amount: number;
    vestPeriodInSeconds: number;
    creationTimestamp: number;
    withdrawnAmount: number;
  }[];
}

interface Vest {
  id: string;
  amount: BigNumber;
  vestPeriodInSeconds: number;
  creationTimestamp: number;
  withdrawnAmount: BigNumber;
  countdownTimer: Timer;
  locked: boolean;
}
