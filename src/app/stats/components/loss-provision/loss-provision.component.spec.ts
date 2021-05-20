import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LossProvisionComponent } from './loss-provision.component';

describe('LossProvisionComponent', () => {
  let component: LossProvisionComponent;
  let fixture: ComponentFixture<LossProvisionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LossProvisionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LossProvisionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
