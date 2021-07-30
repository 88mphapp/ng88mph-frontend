import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html',
  styleUrls: ['./terms-of-service.component.css'],
})
export class TermsOfServiceComponent implements OnInit {
  @Output() userAcceptedTerms: EventEmitter<boolean>;

  acceptedTerms: boolean;

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit(): void {
    this.resetData();
  }

  resetData() {
    this.acceptedTerms = false;
  }

  acceptTerms() {
    this.activeModal.close(true);
  }
}
