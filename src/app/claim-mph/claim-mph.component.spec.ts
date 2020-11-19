import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimMphComponent } from './claim-mph.component';

describe('ClaimMphComponent', () => {
  let component: ClaimMphComponent;
  let fixture: ComponentFixture<ClaimMphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimMphComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClaimMphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
