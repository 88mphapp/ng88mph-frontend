import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FarmZeroCouponBondComponent } from './farm-zero-coupon-bond.component';

describe('FarmZeroCouponBondComponent', () => {
  let component: FarmZeroCouponBondComponent;
  let fixture: ComponentFixture<FarmZeroCouponBondComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FarmZeroCouponBondComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FarmZeroCouponBondComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
