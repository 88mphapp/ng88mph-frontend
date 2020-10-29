import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  mphBalance: BigNumber;

  constructor(private apollo: Apollo, public wallet: WalletService) {
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

  loadData(): void {
    const mphHolderID = this.wallet.userAddress.toLowerCase();
    const queryString = gql`
      {
        mphholder(id: "${mphHolderID}") {
          mphBalance
          stakedMPHBalance
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
        this.mphBalance = new BigNumber(mphHolder.mphBalance).plus(mphHolder.stakedMPHBalance);
      }
    }
  }

  resetData(): void {
    this.mphBalance = new BigNumber(0);
  }

  connectWallet() {
    this.wallet.connect(() => { }, () => { }, false);
  }
}

interface QueryResult {
  mphholder: {
    mphBalance: number;
    stakedMPHBalance: number;
  };
}
