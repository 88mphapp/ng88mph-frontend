import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalBuyYieldTokenComponent } from './modal-buy-yield-token.component';

describe('ModalBuyYieldTokenComponent', () => {
  let component: ModalBuyYieldTokenComponent;
  let fixture: ComponentFixture<ModalBuyYieldTokenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalBuyYieldTokenComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalBuyYieldTokenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
