import { MIN_GAP, POSITION_STEP } from '../../common/constants';
import { midPoint, nextPosition, positionAfter, renumberPositions } from './task-position.util';

describe('task-position.util', () => {
  describe('nextPosition', () => {
    it('starts from STEP when empty', () => {
      expect(nextPosition(null)).toBe(POSITION_STEP);
      expect(nextPosition(undefined)).toBe(POSITION_STEP);
    });

    it('adds STEP to max', () => {
      expect(nextPosition(3000)).toBe(4000);
    });
  });

  describe('midPoint', () => {
    it('appends STEP when no next', () => {
      expect(midPoint(1000, null)).toBe(2000);
    });

    it('returns midpoint when gap is enough', () => {
      expect(midPoint(1000, 2000)).toBe(1500);
    });

    it('signals renumber when gap below MIN_GAP', () => {
      expect(midPoint(1, 1 + MIN_GAP / 2)).toBeNull();
    });
  });

  describe('renumberPositions', () => {
    it('assigns (i+1)*STEP in order', () => {
      const result = renumberPositions([
        { id: 'a', position: 1.1 },
        { id: 'b', position: 1.2 },
        { id: 'c', position: 9 },
      ]);
      expect(result.map((item) => item.position)).toEqual([1000, 2000, 3000]);
      expect(result.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('positionAfter', () => {
    const ordered = [
      { id: 'a', position: 1000 },
      { id: 'b', position: 2000 },
      { id: 'c', position: 3000 },
    ];

    it('inserts at start when afterId is null', () => {
      const result = positionAfter(ordered, null);
      expect(result).toEqual({ position: 500, needsRenumber: false });
    });

    it('inserts between neighbours', () => {
      const result = positionAfter(ordered, 'a');
      expect(result).toEqual({ position: 1500, needsRenumber: false });
    });

    it('appends after last', () => {
      const result = positionAfter(ordered, 'c');
      expect(result).toEqual({ position: 4000, needsRenumber: false });
    });

    it('requests renumber when gap exhausted', () => {
      const tight = [
        { id: 'a', position: 1 },
        { id: 'b', position: 1 + MIN_GAP / 2 },
      ];
      expect(positionAfter(tight, 'a')).toEqual({ needsRenumber: true });
    });
  });
});
