import { Component, OnInit, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConstantsService } from 'src/app/constants.service';

@Component({
  selector: 'app-modal-transaction-alerts',
  templateUrl: './modal-transaction-alerts.component.html',
  styleUrls: ['./modal-transaction-alerts.component.css'],
})
export class ModalTransactionAlertsComponent implements OnInit {
  @Input() hash: string;
  @Input() networkID: number;
  @Input() txConfirmed: boolean;

  explorerLink: string;

  constructor(
    public activeModal: NgbActiveModal,
    public constants: ConstantsService
  ) {}

  ngOnInit(): void {
    this.explorerLink = this.getExplorerLink();
  }

  // @dev this will need to be updated when non-ethereum chains are in use
  // @dev see below link from sushiswap for inspiration
  // https://github.com/sushiswap/sushiswap-interface/blob/canary/src/functions/explorer.ts
  getExplorerLink(): string {
    const prefix = `https://${
      this.networkID === 1
        ? ''
        : this.constants.NETWORK_METADATA[
            this.networkID
          ].chainName.toLowerCase()
    }.etherscan.io`;
    const suffix = `/tx/${this.hash}`;
    return prefix + suffix;
  }
}
