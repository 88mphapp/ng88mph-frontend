import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PriceEarningsRatioComponent } from './price-earnings-ratio.component';

describe('PriceEarningsRatioComponent', () => {
  let component: PriceEarningsRatioComponent;
  let fixture: ComponentFixture<PriceEarningsRatioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PriceEarningsRatioComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PriceEarningsRatioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
