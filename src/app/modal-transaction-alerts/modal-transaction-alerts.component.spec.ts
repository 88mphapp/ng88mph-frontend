import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalTransactionAlertsComponent } from './modal-transaction-alerts.component';

describe('ModalTransactionAlertsComponent', () => {
  let component: ModalTransactionAlertsComponent;
  let fixture: ComponentFixture<ModalTransactionAlertsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalTransactionAlertsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalTransactionAlertsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
