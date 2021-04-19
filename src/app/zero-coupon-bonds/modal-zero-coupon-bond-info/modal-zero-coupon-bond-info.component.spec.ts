import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalZeroCouponBondInfoComponent } from './modal-zero-coupon-bond-info.component';

describe('ModalZeroCouponBondInfoComponent', () => {
  let component: ModalZeroCouponBondInfoComponent;
  let fixture: ComponentFixture<ModalZeroCouponBondInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalZeroCouponBondInfoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalZeroCouponBondInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
