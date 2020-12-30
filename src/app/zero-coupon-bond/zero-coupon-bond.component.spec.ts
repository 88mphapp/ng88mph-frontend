import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZeroCouponBondComponent } from './zero-coupon-bond.component';

describe('ZeroCouponBondComponent', () => {
  let component: ZeroCouponBondComponent;
  let fixture: ComponentFixture<ZeroCouponBondComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ZeroCouponBondComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZeroCouponBondComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
