import { Component, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import { MerkleService } from '../merkle.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-funding',
  templateUrl: './funding.component.html',
  styleUrls: ['./funding.component.css'],
})
export class FundingComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
