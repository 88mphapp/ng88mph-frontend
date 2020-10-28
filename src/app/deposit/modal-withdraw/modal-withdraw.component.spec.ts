import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalWithdrawComponent } from './modal-withdraw.component';

describe('ModalWithdrawComponent', () => {
  let component: ModalWithdrawComponent;
  let fixture: ComponentFixture<ModalWithdrawComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalWithdrawComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalWithdrawComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
