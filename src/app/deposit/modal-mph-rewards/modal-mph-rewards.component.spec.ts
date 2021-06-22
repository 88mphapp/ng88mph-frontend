import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalMphRewardsComponent } from './modal-mph-rewards.component';

describe('ModalMphRewardsComponent', () => {
  let component: ModalMphRewardsComponent;
  let fixture: ComponentFixture<ModalMphRewardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalMphRewardsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalMphRewardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
