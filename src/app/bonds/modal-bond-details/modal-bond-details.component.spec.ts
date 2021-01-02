import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalBondDetailsComponent } from './modal-bond-details.component';

describe('ModalBondDetailsComponent', () => {
  let component: ModalBondDetailsComponent;
  let fixture: ComponentFixture<ModalBondDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalBondDetailsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalBondDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
