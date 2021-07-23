import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalWithdrawYieldTokenInterestComponent } from './modal-withdraw-yield-token-interest.component';

describe('ModalWithdrawYieldTokenInterestComponent', () => {
  let component: ModalWithdrawYieldTokenInterestComponent;
  let fixture: ComponentFixture<ModalWithdrawYieldTokenInterestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalWithdrawYieldTokenInterestComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalWithdrawYieldTokenInterestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
