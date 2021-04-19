import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WithdrawZeroCouponBondComponent } from './withdraw-zero-coupon-bond.component';

describe('WithdrawZeroCouponBondComponent', () => {
  let component: WithdrawZeroCouponBondComponent;
  let fixture: ComponentFixture<WithdrawZeroCouponBondComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WithdrawZeroCouponBondComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WithdrawZeroCouponBondComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
