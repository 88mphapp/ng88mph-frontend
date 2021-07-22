import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoricalFixedInterestRatesComponent } from './historical-fixed-interest-rates.component';

describe('HistoricalFixedInterestRatesComponent', () => {
  let component: HistoricalFixedInterestRatesComponent;
  let fixture: ComponentFixture<HistoricalFixedInterestRatesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HistoricalFixedInterestRatesComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HistoricalFixedInterestRatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
