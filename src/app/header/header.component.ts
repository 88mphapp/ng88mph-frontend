import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult, ApolloClient, InMemoryCache } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import gql from 'graphql-tag';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';
import { Watch } from '../watch';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  mphBalance: BigNumber;
  depositValueLocked: BigNumber;
  farmingValueLocked: BigNumber;
  sushiFarmingValueLocked: BigNumber;
  bancorFarmingValueLocked: BigNumber;
  mphPriceUSD: BigNumber;
  bntPriceUSD: BigNumber;

  watchedModel = new Watch(false, "");

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

    if (loadUser && this.wallet.connected && !this.wallet.watching) {
      const mphToken = this.contract.getNamedContract('MPHToken', readonlyWeb3);
      mphToken.methods.balanceOf(this.wallet.userAddress).call().then(mphBalance => {
        this.mphBalance = new BigNumber(mphBalance).div(this.constants.PRECISION);
      });
    } else {
      const mphToken = this.contract.getNamedContract('MPHToken', readonlyWeb3);
      mphToken.methods.balanceOf(this.wallet.watchedAddress).call().then(mphBalance => {
        this.mphBalance = new BigNumber(mphBalance).div(this.constants.PRECISION);
      });
    }

    if (loadGlobal) {
      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();

      //uni
      const uniswap = new ApolloClient({
        uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
        cache: new InMemoryCache(),
      });

      let uniswapQueryString = `query Uniswap {`;
      uniswapQueryString +=
      `pair(
        id: "${this.constants.UNISWAP_LP.toLowerCase()}",
      ) {
        reserveUSD
      }`;
      uniswapQueryString += `}`;
      const uniswapQuery = gql`${uniswapQueryString}`;

      uniswap.query<QueryResult>({
        query: uniswapQuery
      }).then(result =>
        this.farmingValueLocked = new BigNumber(result.data.pair.reserveUSD)
      );

      //sushi
      const sushiswap = new ApolloClient({
        uri: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
        cache: new InMemoryCache(),
      });

      let sushiswapQueryString = `query SushiSwap {`;
        sushiswapQueryString +=
        `pair(
          id: "${this.constants.SUSHI_LP.toLowerCase()}",
        ) {
          reserveUSD
        }`;
      sushiswapQueryString += `}`;
      const sushiswapQuery = gql`${sushiswapQueryString}`;

      sushiswap.query<QueryResult>({
        query: sushiswapQuery
      }).then(result =>
        this.sushiFarmingValueLocked = new BigNumber(result.data.pair.reserveUSD)
      );

      //bancor
      const apiStr = `https://api-v2.bancor.network/pools?dlt_type=ethereum&dlt_id=${this.constants.BANCOR_MPHBNT_POOL}`;
      const result = await this.helpers.httpsGet(apiStr);
      this.bancorFarmingValueLocked = new BigNumber(result.data[0].liquidity.usd);
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
      this.sushiFarmingValueLocked = new BigNumber(0);
      this.bancorFarmingValueLocked = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
      this.bntPriceUSD = new BigNumber(0);
    }
  }

  connectWallet() {
    this.wallet.connect(() => { }, () => { }, false);
  }

  onSubmit() {
    this.wallet.watchWallet(this.watchedModel.address);
    this.loadData(true, true);
  }

  switchFocus(watching: boolean) {
    this.wallet.watch.watching = watching;
    this.loadData(true, true);
  }

}

interface QueryResult {
  dpools: {
    id: string;
    stablecoin: string;
    totalActiveDeposit: number;
  }[];
  pair: {
    reserveUSD: number;
  }
}
