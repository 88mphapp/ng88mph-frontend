import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  mphBalance: BigNumber;
  depositValueLocked: BigNumber;
  farmingValueLocked: BigNumber;
  mphPriceUSD: BigNumber;

  constructor(private apollo: Apollo, public wallet: WalletService, public contract: ContractService,
    public constants: ConstantsService, public helpers: HelpersService) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const queryString = gql`
    {
      ${loadGlobal ? `
        dpools {
          id
          stablecoin
          totalActiveDeposit
        }
      ` : ''}
    }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => this.handleData(x));

    const readonlyWeb3 = this.wallet.readonlyWeb3();

    if (loadUser && this.wallet.connected) {
      const mphToken = this.contract.getNamedContract('MPHToken', readonlyWeb3);
      mphToken.methods.balanceOf(this.wallet.userAddress).call().then(mphBalance => {
        this.mphBalance = new BigNumber(mphBalance).div(this.constants.PRECISION);
      });
    }

    if (loadGlobal) {
      const rewards = this.contract.getNamedContract('Farming', readonlyWeb3);
      const totalStakedMPHLPBalance = new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION);
      const mphLPPriceUSD = await this.helpers.getMPHLPPriceUSD();
      this.farmingValueLocked = totalStakedMPHLPBalance.times(mphLPPriceUSD);
      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();
    }
  }

  handleData(queryResult: ApolloQueryResult<QueryResult>): void {
    if (!queryResult.loading) {
      const dpools = queryResult.data.dpools;
      if (dpools) {
        let totalDepositUSD = new BigNumber(0);
        let stablecoinPriceCache = {};
        Promise.all(
          dpools.map(async pool => {
            let stablecoinPrice = stablecoinPriceCache[pool.stablecoin];
            if (!stablecoinPrice) {
              stablecoinPrice = await this.helpers.getTokenPriceUSD(pool.stablecoin);
              stablecoinPriceCache[pool.stablecoin] = stablecoinPrice;
            }

            const poolDepositUSD = new BigNumber(pool.totalActiveDeposit).times(stablecoinPrice);
            totalDepositUSD = totalDepositUSD.plus(poolDepositUSD);
          })
        ).then(() => {
          this.depositValueLocked = totalDepositUSD;
        });
      }
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.mphBalance = new BigNumber(0);
    }

    if (resetGlobal) {
      this.depositValueLocked = new BigNumber(0);
      this.farmingValueLocked = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
    }
  }

  connectWallet() {
    this.wallet.connect(() => { }, () => { }, false);
  }
}

interface QueryResult {
  dpools: {
    id: string;
    stablecoin: string;
    totalActiveDeposit: number;
  }[];
}
