import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-modal-deposit',
  templateUrl: './modal-deposit.component.html',
  styleUrls: ['./modal-deposit.component.css']
})
export class ModalDepositComponent implements OnInit {

  constructor(public activeModal: NgbActiveModal) { }

  ngOnInit(): void {
  }

}
