import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimETHComponent } from './claim-eth.component';

describe('ClaimETHComponent', () => {
  let component: ClaimETHComponent;
  let fixture: ComponentFixture<ClaimETHComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimETHComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClaimETHComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
