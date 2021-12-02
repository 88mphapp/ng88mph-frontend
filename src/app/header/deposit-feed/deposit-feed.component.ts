import { Component, OnInit, NgZone } from '@angular/core';
import { ConstantsService } from 'src/app/constants.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { TimeSeriesService } from 'src/app/timeseries.service';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';

@Component({
  selector: 'app-deposit-feed',
  templateUrl: './deposit-feed.component.html',
  styleUrls: ['./deposit-feed.component.css'],
})
export class DepositFeedComponent implements OnInit {
  index: number;
  displayIndex: number;
  allDeposits: Deposit[];

  constructor(
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    public timeseries: TimeSeriesService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.resetData();
    this.loadData(this.wallet.networkID);
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData();
        this.loadData(networkID);
      });
    });
  }

  resetData() {
    this.index = 0;
    this.displayIndex = 0;
    this.allDeposits = [];
  }

  loadData(networkID: number) {
    this.index =
      this.timeseries.getLatestUTCDate() - this.constants.WEEK_IN_SEC;
    this.displayIndex = this.index;

    const queryString = gql`
      {
        dpools {
          address
          deposits (
            where: {
              depositTimestamp_gte: "${this.index}",
              virtualTokenTotalSupply_gte: "${this.constants.DUST_THRESHOLD}"
            }
          ) {
            amount
            interestRate
            feeRate
            depositTimestamp
            maturationTimestamp
            depositLength
          }
        }
      }
    `;
    request(this.constants.GRAPHQL_ENDPOINT[networkID], queryString).then(
      (data: QueryResult) => this.handleData(data, networkID)
    );
  }

  handleData(data: QueryResult, networkID: number) {
    if (this.wallet.networkID !== networkID) {
      return;
    }

    const dpools = data.dpools;

    let allDeposits: Deposit[] = [];
    Promise.all(
      dpools.map((pool) => {
        if (pool.deposits.length > 0) {
          const poolInfo = this.contract.getPoolInfoFromAddress(
            pool.address,
            networkID
          );

          for (let deposit of pool.deposits) {
            const depositObj: Deposit = {
              name: poolInfo.name,
              protocol: poolInfo.protocol,
              stablecoin: poolInfo.stablecoin,
              stablecoinSymbol: poolInfo.stablecoinSymbol,
              iconPath: poolInfo.iconPath,
              depositAmount: new BigNumber(deposit.amount),
              interestAmount: new BigNumber(deposit.amount).times(
                deposit.interestRate
              ),
              feeAmount: new BigNumber(deposit.amount).times(deposit.feeRate),
              depositTimestamp: parseInt(deposit.depositTimestamp),
              maturationTimestamp: parseInt(deposit.maturationTimestamp),
              apr: new BigNumber(deposit.interestRate)
                .times(this.constants.YEAR_IN_SEC)
                .div(deposit.depositLength)
                .times(100),
            };

            allDeposits.push(depositObj);
          }
        }
      })
    ).then(() => {
      allDeposits.sort((a, b) => {
        return a.stablecoinSymbol > b.stablecoinSymbol
          ? 1
          : a.stablecoinSymbol < b.stablecoinSymbol
          ? -1
          : 0;
      });
      this.allDeposits = allDeposits;
    });
  }

  sortBy(event: any) {
    if (event.active === 'asset') {
      this.allDeposits =
        event.direction === 'asc'
          ? [
              ...this.allDeposits.sort((a, b) =>
                a[event.active] > b[event.active] ? 1 : -1
              ),
            ]
          : [
              ...this.allDeposits.sort((a, b) =>
                b[event.active] > a[event.active] ? 1 : -1
              ),
            ];
    } else {
      this.allDeposits =
        event.direction === 'asc'
          ? [
              ...this.allDeposits.sort(
                (a, b) => a[event.active] - b[event.active]
              ),
            ]
          : [
              ...this.allDeposits.sort(
                (a, b) => b[event.active] - a[event.active]
              ),
            ];
    }
  }

  timestampToDateString(
    timestampSec: number,
    detailed: boolean = false
  ): string {
    return detailed
      ? new Date(timestampSec * 1e3).toLocaleString('en-US', {
          timeZone: 'UTC',
          timeZoneName: 'short',
        })
      : new Date(timestampSec * 1e3).toLocaleDateString();
  }
}

interface QueryResult {
  dpools: {
    address: string;
    deposits: {
      amount: string;
      interestRate: string;
      feeRate: string;
      depositTimestamp: string;
      maturationTimestamp: string;
      depositLength: string;
    }[];
  }[];
}

interface Deposit {
  name: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  iconPath: string;
  depositAmount: BigNumber;
  interestAmount: BigNumber;
  feeAmount: BigNumber;
  depositTimestamp: number;
  maturationTimestamp: number;
  apr: BigNumber;
}
