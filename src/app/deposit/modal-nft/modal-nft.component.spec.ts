import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalNftComponent } from './modal-nft.component';

describe('ModalNftComponent', () => {
  let component: ModalNftComponent;
  let fixture: ComponentFixture<ModalNftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalNftComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalNftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
