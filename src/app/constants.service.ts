import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';

@Injectable({
  providedIn: 'root'
})
export class ConstantsService {
  PRECISION = 1e18;
  YEAR_IN_SEC = 31556952;
  MONTH_IN_SEC = 30 * 24 * 60 * 60;
  WEEK_IN_SEC = 7 * 24 * 60 * 60;
  DAY_IN_SEC = 24 * 60 * 60;
  WETH_ADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  GOV_TREASURY = '0x56f34826Cc63151f74FA8f701E4f73C5EAae52AD';
  DEV_WALLET = '0xfecBad5D60725EB6fd10f8936e02fa203fd27E4b';
}
