import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-modal-mph-rewards',
  templateUrl: './modal-mph-rewards.component.html',
  styleUrls: ['./modal-mph-rewards.component.css']
})
export class ModalMphRewardsComponent implements OnInit {

  constructor(
    public activeModal: NgbActiveModal
  ) { }

  ngOnInit(): void {
  }

}
