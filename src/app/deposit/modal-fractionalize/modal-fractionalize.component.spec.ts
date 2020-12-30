import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalFractionalizeComponent } from './modal-fractionalize.component';

describe('ModalFractionalizeComponent', () => {
  let component: ModalFractionalizeComponent;
  let fixture: ComponentFixture<ModalFractionalizeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalFractionalizeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalFractionalizeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
