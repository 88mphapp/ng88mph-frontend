import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoricalStakingRewardsComponent } from './historical-staking-rewards.component';

describe('HistoricalStakingRewardsComponent', () => {
  let component: HistoricalStakingRewardsComponent;
  let fixture: ComponentFixture<HistoricalStakingRewardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HistoricalStakingRewardsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HistoricalStakingRewardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
