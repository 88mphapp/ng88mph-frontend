import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZeroCouponBondsComponent } from './zero-coupon-bonds.component';

describe('ZeroCouponBondsComponent', () => {
  let component: ZeroCouponBondsComponent;
  let fixture: ComponentFixture<ZeroCouponBondsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ZeroCouponBondsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZeroCouponBondsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
