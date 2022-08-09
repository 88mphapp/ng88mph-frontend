import { TestBed } from '@angular/core/testing';

import { BalancerService } from './balancer.service';

describe('BalancerService', () => {
  let service: BalancerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BalancerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
