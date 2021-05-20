import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FundedInterestExpensesComponent } from './funded-interest-expenses.component';

describe('FundedInterestExpensesComponent', () => {
  let component: FundedInterestExpensesComponent;
  let fixture: ComponentFixture<FundedInterestExpensesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FundedInterestExpensesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FundedInterestExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
