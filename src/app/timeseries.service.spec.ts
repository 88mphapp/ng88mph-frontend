import { TestBed } from '@angular/core/testing';

import { TimeseriesService } from './timeseries.service';

describe('TimeseriesService', () => {
  let service: TimeseriesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeseriesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
