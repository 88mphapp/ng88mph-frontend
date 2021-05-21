import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetInterestMarginComponent } from './net-interest-margin.component';

describe('NetInterestMarginComponent', () => {
  let component: NetInterestMarginComponent;
  let fixture: ComponentFixture<NetInterestMarginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NetInterestMarginComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NetInterestMarginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
