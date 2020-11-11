import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';

@Injectable({
  providedIn: 'root'
})
export class ConstantsService {
  PRECISION = 1e18;
  YEAR_IN_SEC = 31556952;
  WETH_ADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
}
