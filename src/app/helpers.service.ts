import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import CoinGecko from 'coingecko-api';

@Injectable({
  providedIn: 'root'
})
export class HelpersService {
  private coinGeckoClient: CoinGecko;

  constructor() {
    this.coinGeckoClient = new CoinGecko();
  }

  async getTokenPriceUSD(address: string): Promise<number> {
    const rawData = await this.coinGeckoClient.coins.fetchCoinContractMarketChart(address, 'ethereum', {
      days: 0
    });
    if (rawData.success) {
      return rawData.data.prices[0][1];
    } else {
      return 0;
    }
  }
}
