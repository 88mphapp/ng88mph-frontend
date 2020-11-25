import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalUnstakeComponent } from './modal-unstake.component';

describe('ModalUnstakeComponent', () => {
  let component: ModalUnstakeComponent;
  let fixture: ComponentFixture<ModalUnstakeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalUnstakeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalUnstakeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
