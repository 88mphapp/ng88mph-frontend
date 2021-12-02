import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepositFeedComponent } from './deposit-feed.component';

describe('DepositFeedComponent', () => {
  let component: DepositFeedComponent;
  let fixture: ComponentFixture<DepositFeedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DepositFeedComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DepositFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
