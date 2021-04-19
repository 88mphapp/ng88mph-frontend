import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalStakeZCBLPComponent } from './modal-stake-zcblp.component';

describe('ModalStakeZCBLPComponent', () => {
  let component: ModalStakeZCBLPComponent;
  let fixture: ComponentFixture<ModalStakeZCBLPComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalStakeZCBLPComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalStakeZCBLPComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
