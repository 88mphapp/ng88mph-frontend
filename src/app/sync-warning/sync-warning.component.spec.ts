import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SyncWarningComponent } from './sync-warning.component';

describe('SyncWarningComponent', () => {
  let component: SyncWarningComponent;
  let fixture: ComponentFixture<SyncWarningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SyncWarningComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SyncWarningComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
