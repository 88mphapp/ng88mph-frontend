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

  getExplorerLink(): string {
    const prefix =
      this.constants.NETWORK_METADATA[this.networkID].blockExplorerUrls[0];
    const suffix = `/tx/${this.hash}`;
    return prefix + suffix;
  }
}
