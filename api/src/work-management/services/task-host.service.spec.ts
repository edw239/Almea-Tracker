import { systemKeyFor } from './task-host.service';

describe('systemKeyFor', () => {
  it('builds stable entity list key', () => {
    expect(systemKeyFor('brand', 'xlash')).toBe('entity:brand:xlash');
  });
});
