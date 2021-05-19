import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoricalMphPeRatioComponent } from './historical-mph-pe-ratio.component';

describe('HistoricalMphPeRatioComponent', () => {
  let component: HistoricalMphPeRatioComponent;
  let fixture: ComponentFixture<HistoricalMphPeRatioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HistoricalMphPeRatioComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HistoricalMphPeRatioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
