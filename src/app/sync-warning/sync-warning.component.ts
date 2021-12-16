import { Component, OnInit } from '@angular/core';
import { request, gql } from 'graphql-request';
import { ConstantsService } from '../constants.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-sync-warning',
  templateUrl: './sync-warning.component.html',
  styleUrls: ['./sync-warning.component.css'],
})
export class SyncWarningComponent implements OnInit {
  syncBlockNumber: number;
  latestBlockNumber: number;
  displayDetails: boolean;

  constructor(
    public constants: ConstantsService,
    public wallet: WalletService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData(this.wallet.networkID);
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData();
      this.loadData(networkID);
    });
  }

  loadData(networkID: number) {
    const queryString = gql`
      {
        _meta {
          block {
            number
          }
        }
      }
    `;
    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data) => this.handleData(data, networkID));
  }

  async handleData(queryResult: QueryResult, networkID: number) {
    if (networkID !== this.wallet.networkID) {
      return;
    }

    this.syncBlockNumber = queryResult._meta.block.number;
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    this.latestBlockNumber = await readonlyWeb3.eth.getBlockNumber();
  }

  resetData(): void {
    this.syncBlockNumber = 0;
    this.latestBlockNumber = 0;
    this.displayDetails = false;
  }

  shouldDisplay(): boolean {
    return (
      this.latestBlockNumber >=
      this.syncBlockNumber + this.constants.SUBGRAPH_SYNC_WARNING_THRESHOLD
    );
  }

  shouldDisplayDetails() {
    this.displayDetails = !this.displayDetails;
  }
}

interface QueryResult {
  _meta: {
    block: {
      number: number;
    };
  };
}
