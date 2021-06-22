import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalTopUpComponent } from './modal-top-up.component';

describe('ModalTopUpComponent', () => {
  let component: ModalTopUpComponent;
  let fixture: ComponentFixture<ModalTopUpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalTopUpComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalTopUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
