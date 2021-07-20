import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoricalAssetTvlComponent } from './historical-asset-tvl.component';

describe('HistoricalAssetTvlComponent', () => {
  let component: HistoricalAssetTvlComponent;
  let fixture: ComponentFixture<HistoricalAssetTvlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HistoricalAssetTvlComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HistoricalAssetTvlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
