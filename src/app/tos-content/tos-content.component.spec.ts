import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TosContentComponent } from './tos-content.component';

describe('TosContentComponent', () => {
  let component: TosContentComponent;
  let fixture: ComponentFixture<TosContentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TosContentComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TosContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
