import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterestExpenseComponent } from './interest-expense.component';

describe('InterestExpenseComponent', () => {
  let component: InterestExpenseComponent;
  let fixture: ComponentFixture<InterestExpenseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterestExpenseComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InterestExpenseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
