import { ComponentFixture, TestBed } from '@angular/core/testing';

import { XmphSupplyDistributionComponent } from './xmph-supply-distribution.component';

describe('XmphSupplyDistributionComponent', () => {
  let component: XmphSupplyDistributionComponent;
  let fixture: ComponentFixture<XmphSupplyDistributionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [XmphSupplyDistributionComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(XmphSupplyDistributionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
