import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MphSupplyDistributionComponent } from './mph-supply-distribution.component';

describe('MphSupplyDistributionComponent', () => {
  let component: MphSupplyDistributionComponent;
  let fixture: ComponentFixture<MphSupplyDistributionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MphSupplyDistributionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MphSupplyDistributionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
