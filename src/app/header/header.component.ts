import { Component, OnInit } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
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
      //uni
      const rewards = this.contract.getNamedContract('Farming', readonlyWeb3);
      const totalStakedMPHLPBalance = new BigNumber(await rewards.methods.totalSupply().call()).div(this.constants.PRECISION);
      const mphLPPriceUSD = await this.helpers.getMPHLPPriceUSD();
      this.farmingValueLocked = totalStakedMPHLPBalance.times(mphLPPriceUSD);
      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();

      //sushi
      const sushiLPToken = this.contract.getERC20(this.constants.SUSHI_LP, readonlyWeb3);
      const stakedSushiLPToken = new BigNumber(await sushiLPToken.methods.balanceOf(this.constants.SUSHI_MASTERCHEF).call()).div(this.constants.PRECISION);
      const sushiMphLPPriceUSD  = await this.helpers.getLPPriceUSD(this.constants.SUSHI_LP);
      this.sushiFarmingValueLocked = stakedSushiLPToken.times(sushiMphLPPriceUSD);

      //bancor
      const bancorLiquidityProtectionStats = this.contract.getContract(this.constants.BANCOR_LP_STATS, 'LiquidityProtectionStats', readonlyWeb3);
      const bancorTotalStakedMPH = new BigNumber(await bancorLiquidityProtectionStats.methods.totalReserveAmount(this.constants.BANCOR_MPHBNT_POOL, this.constants.MPH).call()).div(this.constants.PRECISION);
      const bancorTotalStakedBNT = new BigNumber(await bancorLiquidityProtectionStats.methods.totalReserveAmount(this.constants.BANCOR_MPHBNT_POOL, this.constants.BNT).call()).div(this.constants.PRECISION);
      this.bntPriceUSD = new BigNumber(await this.helpers.getTokenPriceUSD(this.constants.BNT));
      this.bancorFarmingValueLocked = bancorTotalStakedMPH.times(this.mphPriceUSD).plus(bancorTotalStakedBNT.times(this.bntPriceUSD));
      // this seems to be off by a little bit, likely because it only accounts for protected liquidity

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
}
