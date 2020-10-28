import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ModalDepositComponent } from './modal-deposit/modal-deposit.component';
import { ModalWithdrawComponent } from './modal-withdraw/modal-withdraw.component';

@Component({
  selector: 'app-deposit',
  templateUrl: './deposit.component.html',
  styleUrls: ['./deposit.component.css']
})
export class DepositComponent implements OnInit {

  constructor(private modalService: NgbModal) { }

  ngOnInit(): void {
  }

  openDepositModal() {
    const modalRef = this.modalService.open(ModalDepositComponent, { windowClass: 'fullscreen' });
  }

  openWithdrawModal() {
    const modalRef = this.modalService.open(ModalWithdrawComponent, { windowClass: 'fullscreen' });
  }

}
