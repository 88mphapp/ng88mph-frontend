import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MintZeroCouponBondComponent } from './mint-zero-coupon-bond.component';

describe('MintZeroCouponBondComponent', () => {
  let component: MintZeroCouponBondComponent;
  let fixture: ComponentFixture<MintZeroCouponBondComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MintZeroCouponBondComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MintZeroCouponBondComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
