import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DaoComponent } from './dao.component';

describe('DaoComponent', () => {
  let component: DaoComponent;
  let fixture: ComponentFixture<DaoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DaoComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DaoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
