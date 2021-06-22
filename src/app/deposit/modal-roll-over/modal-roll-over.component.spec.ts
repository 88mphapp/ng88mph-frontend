import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalRollOverComponent } from './modal-roll-over.component';

describe('ModalRollOverComponent', () => {
  let component: ModalRollOverComponent;
  let fixture: ComponentFixture<ModalRollOverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalRollOverComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalRollOverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
