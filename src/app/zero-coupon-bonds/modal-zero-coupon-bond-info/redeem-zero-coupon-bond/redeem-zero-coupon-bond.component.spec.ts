import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RedeemZeroCouponBondComponent } from './redeem-zero-coupon-bond.component';

describe('RedeemZeroCouponBondComponent', () => {
  let component: RedeemZeroCouponBondComponent;
  let fixture: ComponentFixture<RedeemZeroCouponBondComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RedeemZeroCouponBondComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RedeemZeroCouponBondComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
