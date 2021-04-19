import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalUnstakeZCBLPComponent } from './modal-unstake-zcblp.component';

describe('ModalUnstakeZCBLPComponent', () => {
  let component: ModalUnstakeZCBLPComponent;
  let fixture: ComponentFixture<ModalUnstakeZCBLPComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalUnstakeZCBLPComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalUnstakeZCBLPComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
