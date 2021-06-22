import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MphLiquidityComponent } from './mph-liquidity.component';

describe('MphLiquidityComponent', () => {
  let component: MphLiquidityComponent;
  let fixture: ComponentFixture<MphLiquidityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MphLiquidityComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MphLiquidityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
