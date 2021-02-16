import { Component, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import { MerkleService } from '../merkle.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-funding',
  templateUrl: './funding.component.html',
  styleUrls: ['./funding.component.css']
})
export class FundingComponent implements OnInit {
  claimAmount: BigNumber;
  claimed: boolean;

  constructor(
    public wallet: WalletService,
    public merkle: MerkleService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
  }

  async loadData() {
    if (this.wallet.connected) {
      const claim = this.merkle.getETHClaimForAddress(this.wallet.userAddress);
      this.claimAmount = new BigNumber(claim.amount).div(1e18);

      const distributor = this.merkle.getETHMerkleDistributor();
      this.claimed = await distributor.methods.isClaimed(claim.index).call();
    }
  }

  resetData() {
    this.claimAmount = new BigNumber(0);
    this.claimed = false;
  }

  claim() {
    const distributor = this.merkle.getETHMerkleDistributor();
    const claim = this.merkle.getETHClaimForAddress(this.wallet.userAddress);
    const func = distributor.methods.claim(claim.index, this.wallet.userAddress, claim.amount, claim.proof);

    this.wallet.sendTx(func, () => { }, () => { }, (error) => { this.wallet.displayGenericError(error) });
  }
}
