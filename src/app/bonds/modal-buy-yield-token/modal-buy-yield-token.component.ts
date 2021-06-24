import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-modal-buy-yield-token',
  templateUrl: './modal-buy-yield-token.component.html',
  styleUrls: ['./modal-buy-yield-token.component.css'],
})
export class ModalBuyYieldTokenComponent implements OnInit {
  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit(): void {}
}
