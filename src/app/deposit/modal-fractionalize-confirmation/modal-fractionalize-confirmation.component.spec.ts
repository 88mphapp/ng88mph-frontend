import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalFractionalizeConfirmationComponent } from './modal-fractionalize-confirmation.component';

describe('ModalFractionalizeConfirmationComponent', () => {
  let component: ModalFractionalizeConfirmationComponent;
  let fixture: ComponentFixture<ModalFractionalizeConfirmationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalFractionalizeConfirmationComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalFractionalizeConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
