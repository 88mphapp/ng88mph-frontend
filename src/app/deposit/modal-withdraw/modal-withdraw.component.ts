import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-modal-withdraw',
  templateUrl: './modal-withdraw.component.html',
  styleUrls: ['./modal-withdraw.component.css']
})
export class ModalWithdrawComponent implements OnInit {

  constructor(public activeModal: NgbActiveModal) { }

  ngOnInit(): void {
  }

}
