import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FundedExpenseComponent } from './funded-expense.component';

describe('FundedExpenseComponent', () => {
  let component: FundedExpenseComponent;
  let fixture: ComponentFixture<FundedExpenseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FundedExpenseComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FundedExpenseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
