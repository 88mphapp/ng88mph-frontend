import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ModalUnstakeComponent } from './modal-unstake/modal-unstake.component';

@Component({
  selector: 'app-gauge',
  templateUrl: './gauge.component.html',
  styleUrls: ['./gauge.component.css'],
})
export class GaugeComponent implements OnInit {
  constructor(private modalService: NgbModal) {}

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeComponent, {
      windowClass: 'fullscreen',
    });
  }

  ngOnInit(): void {}
}
