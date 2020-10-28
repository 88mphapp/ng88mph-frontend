import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalStakeComponent } from './modal-stake.component';

describe('ModalStakeComponent', () => {
  let component: ModalStakeComponent;
  let fixture: ComponentFixture<ModalStakeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalStakeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalStakeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
