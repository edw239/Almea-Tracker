import {
  buildMemberRows,
  datesAreOrdered,
  daysBetween,
  decideListMoveProject,
  decideTaskProjectLink,
  formatProjectDate,
  gateStatusChange,
  isProjectReady,
  parseProjectDate,
  projectListSystemKey,
  projectSignal,
} from './project-rules.util';

const open = { id: 'p1', status: 'ACTIVE' as const };
const closed = { id: 'p1', status: 'CLOSED' as const };
const other = { id: 'p2', status: 'ACTIVE' as const };

describe('project dates', () => {
  it('rejects impossible calendar days', () => {
    expect(parseProjectDate('2026-02-31')).toBeNull();
    expect(parseProjectDate('2026-1-01')).toBeNull();
    const parsed = parseProjectDate('2026-11-19');
    expect(parsed?.toISOString()).toBe('2026-11-19T00:00:00.000Z');
    expect(formatProjectDate(parsed!)).toBe('2026-11-19');
  });

  it('counts whole calendar days', () => {
    expect(daysBetween('2026-11-19', '2026-11-19')).toBe(0);
    expect(daysBetween('2026-11-19', '2026-11-26')).toBe(7);
    expect(datesAreOrdered('2026-11-01', '2026-11-19')).toBe(true);
    expect(datesAreOrdered('2026-11-20', '2026-11-19')).toBe(false);
    expect(datesAreOrdered(null, '2026-11-19')).toBe(true);
  });
});

describe('projectSignal', () => {
  const today = '2026-11-19';

  it('is red after the target even with an empty queue', () => {
    expect(
      projectSignal({ status: 'ACTIVE', targetEndDate: '2026-11-18', openTaskCount: 0, today }),
    ).toBe('red');
  });

  it('is amber only inside the window and only with open work', () => {
    expect(
      projectSignal({ status: 'ACTIVE', targetEndDate: '2026-11-25', openTaskCount: 2, today }),
    ).toBe('amber');
    expect(
      projectSignal({ status: 'ACTIVE', targetEndDate: '2026-11-25', openTaskCount: 0, today }),
    ).toBe('green');
    expect(
      projectSignal({ status: 'ACTIVE', targetEndDate: '2026-11-26', openTaskCount: 4, today }),
    ).toBe('green');
  });

  it('is green without a date and absent once closed', () => {
    expect(
      projectSignal({ status: 'DRAFT', targetEndDate: null, openTaskCount: 3, today }),
    ).toBe('green');
    expect(
      projectSignal({ status: 'CLOSED', targetEndDate: '2026-11-01', openTaskCount: 3, today }),
    ).toBeNull();
  });
});

describe('project readiness and status', () => {
  it('requires outcome, target and lead together', () => {
    expect(isProjectReady({ outcome: '  ', targetEndDate: '2026-12-01', leadUserId: 'u' })).toBe(false);
    expect(isProjectReady({ outcome: 'Запуск', targetEndDate: '2026-12-01', leadUserId: 'u' })).toBe(true);
  });

  it('keeps close and draft as separate gates', () => {
    expect(gateStatusChange({ from: 'DRAFT', to: 'CLOSED', ready: true })).toBe('USE_CLOSE');
    expect(gateStatusChange({ from: 'ACTIVE', to: 'DRAFT', ready: true })).toBe('BACK_TO_DRAFT');
    expect(gateStatusChange({ from: 'DRAFT', to: 'ACTIVE', ready: false })).toBe('NOT_READY');
    expect(gateStatusChange({ from: 'ACTIVE', to: 'ON_HOLD', ready: true })).toBe('OK');
    expect(gateStatusChange({ from: 'CLOSED', to: 'ACTIVE', ready: true })).toBe('USE_REOPEN');
  });
});

describe('project members', () => {
  it('gives each person one role', () => {
    expect(
      buildMemberRows({ leadUserId: 'u1', sponsorUserId: 'u1', contributorIds: [] }).ok,
    ).toBe(false);
    const built = buildMemberRows({
      leadUserId: 'u1',
      sponsorUserId: 'u2',
      contributorIds: ['u3', 'u3'],
    });
    expect(built).toEqual({
      ok: true,
      rows: [
        { userId: 'u1', role: 'LEAD' },
        { userId: 'u2', role: 'SPONSOR' },
        { userId: 'u3', role: 'CONTRIBUTOR' },
      ],
    });
  });
});

describe('task project link', () => {
  it('attaches a new task and refuses a closed target', () => {
    expect(
      decideTaskProjectLink({ mode: 'create', coordination: null, current: null, requested: undefined }),
    ).toEqual({ projectId: null });
    expect(
      decideTaskProjectLink({ mode: 'create', coordination: null, current: null, requested: closed }),
    ).toEqual({ projectId: undefined, error: 'CLOSED' });
  });

  it('forces coordination-list tasks onto that project', () => {
    expect(
      decideTaskProjectLink({
        mode: 'create',
        coordination: open,
        current: null,
        requested: undefined,
      }),
    ).toEqual({ projectId: 'p1' });
    expect(
      decideTaskProjectLink({ mode: 'update', coordination: open, current: open, requested: null }),
    ).toEqual({ projectId: undefined, error: 'COORDINATION_LOCKED' });
    expect(
      decideTaskProjectLink({ mode: 'create', coordination: closed, current: null, requested: undefined }),
    ).toEqual({ projectId: undefined, error: 'CLOSED' });
  });

  it('freezes links on a closed project and still allows unrelated edits', () => {
    expect(
      decideTaskProjectLink({ mode: 'update', coordination: null, current: closed, requested: undefined }),
    ).toEqual({ projectId: undefined });
    expect(
      decideTaskProjectLink({ mode: 'update', coordination: null, current: closed, requested: null }),
    ).toEqual({ projectId: undefined, error: 'CLOSED' });
    expect(
      decideTaskProjectLink({ mode: 'update', coordination: null, current: open, requested: null }),
    ).toEqual({ projectId: null });
  });

  it('keeps a closed link when the task moves to an ordinary list', () => {
    expect(decideListMoveProject({ current: closed, targetCoordination: null })).toEqual({});
    expect(decideListMoveProject({ current: closed, targetCoordination: other })).toEqual({
      error: 'CLOSED',
    });
    expect(decideListMoveProject({ current: open, targetCoordination: other })).toEqual({
      projectId: 'p2',
    });
  });
});

describe('projectListSystemKey', () => {
  it('is stable per project', () => {
    expect(projectListSystemKey('abc')).toBe('project:abc');
  });
});
