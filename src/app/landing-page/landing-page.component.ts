import { Component, OnInit } from '@angular/core';
import { ConstantsService } from '../constants.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent implements OnInit {
  constructor(
    public constants: ConstantsService,
    public wallet: WalletService
  ) {}

  ngOnInit(): void {}
}
