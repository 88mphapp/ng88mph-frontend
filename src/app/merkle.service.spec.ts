import { TestBed } from '@angular/core/testing';

import { MerkleService } from './merkle.service';

describe('MerkleService', () => {
  let service: MerkleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MerkleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
