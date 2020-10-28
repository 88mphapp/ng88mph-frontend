import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-modal-stake',
  templateUrl: './modal-stake.component.html',
  styleUrls: ['./modal-stake.component.css']
})
export class ModalStakeComponent implements OnInit {

  constructor(public activeModal: NgbActiveModal) { }

  ngOnInit(): void {
  }

}
