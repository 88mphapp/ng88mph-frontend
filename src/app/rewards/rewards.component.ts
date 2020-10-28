import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ModalStakeComponent } from './modal-stake/modal-stake.component';

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.component.html',
  styleUrls: ['./rewards.component.css']
})
export class RewardsComponent implements OnInit {

  constructor(private modalService: NgbModal) { }

  ngOnInit(): void {
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeComponent, { windowClass: 'fullscreen' });
  }

}
