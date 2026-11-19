import {
  PROJECT_CONTRIBUTORS_MAX,
  PROJECT_DUE_SOON_DAYS,
} from '../../common/constants';

export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'ON_HOLD', 'CLOSED'] as const;
export type ProjectStatusName = (typeof PROJECT_STATUSES)[number];

export const PROJECT_WORK_STATUSES = ['DRAFT', 'ACTIVE', 'ON_HOLD'] as const;
export type ProjectWorkStatus = (typeof PROJECT_WORK_STATUSES)[number];

export type ProjectMemberRoleName = 'SPONSOR' | 'LEAD' | 'CONTRIBUTOR';

export type ProjectRef = {
  id: string;
  status: ProjectStatusName;
};

export type ProjectSignal = 'red' | 'amber' | 'green';

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date-only value stored at UTC midnight. Invalid calendar days return null. */
export function parseProjectDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatProjectDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / DAY_MS);
}

export function datesAreOrdered(start: string | null, target: string | null): boolean {
  if (!start || !target) return true;
  return start <= target;
}

export function projectListSystemKey(projectId: string): string {
  return `project:${projectId}`;
}

/**
 * Closed projects have no signal. A passed target is red even with an empty queue.
 * Amber is only the last days before the target, and only while work is still open.
 */
export function projectSignal(input: {
  status: ProjectStatusName;
  targetEndDate: string | null;
  openTaskCount: number;
  today: string;
}): ProjectSignal | null {
  if (input.status === 'CLOSED') return null;
  if (!input.targetEndDate) return 'green';
  if (input.targetEndDate < input.today) return 'red';
  const days = daysBetween(input.today, input.targetEndDate);
  if (days < PROJECT_DUE_SOON_DAYS && input.openTaskCount > 0) return 'amber';
  return 'green';
}

export function isProjectReady(input: {
  outcome: string | null;
  targetEndDate: string | null;
  leadUserId: string | null;
}): boolean {
  return Boolean(input.outcome?.trim() && input.targetEndDate && input.leadUserId);
}

export type StatusGate = 'OK' | 'USE_CLOSE' | 'USE_REOPEN' | 'BACK_TO_DRAFT' | 'NOT_READY';

export function gateStatusChange(input: {
  from: ProjectStatusName;
  to: ProjectStatusName;
  ready: boolean;
}): StatusGate {
  if (input.to === 'CLOSED') return 'USE_CLOSE';
  if (input.from === 'CLOSED') return 'USE_REOPEN';
  if (input.to === 'DRAFT' && input.from !== 'DRAFT') return 'BACK_TO_DRAFT';
  if ((input.to === 'ACTIVE' || input.to === 'ON_HOLD') && !input.ready) return 'NOT_READY';
  return 'OK';
}

export type MemberDraft = {
  leadUserId: string | null;
  sponsorUserId: string | null;
  contributorIds: string[];
};

export function buildMemberRows(
  input: MemberDraft,
):
  | { ok: true; rows: Array<{ userId: string; role: ProjectMemberRoleName }> }
  | { ok: false; error: 'ROLE_CONFLICT' | 'TOO_MANY' } {
  const contributorIds = [...new Set(input.contributorIds)];
  if (contributorIds.length > PROJECT_CONTRIBUTORS_MAX) {
    return { ok: false, error: 'TOO_MANY' };
  }
  const lead = input.leadUserId;
  const sponsor = input.sponsorUserId;
  if (lead && sponsor && lead === sponsor) return { ok: false, error: 'ROLE_CONFLICT' };
  if (lead && contributorIds.includes(lead)) return { ok: false, error: 'ROLE_CONFLICT' };
  if (sponsor && contributorIds.includes(sponsor)) return { ok: false, error: 'ROLE_CONFLICT' };
  const rows: Array<{ userId: string; role: ProjectMemberRoleName }> = [];
  if (lead) rows.push({ userId: lead, role: 'LEAD' });
  if (sponsor) rows.push({ userId: sponsor, role: 'SPONSOR' });
  for (const userId of contributorIds) rows.push({ userId, role: 'CONTRIBUTOR' });
  return { ok: true, rows };
}

export type LinkDecision = {
  projectId: string | null | undefined;
  error?: 'CLOSED' | 'COORDINATION_LOCKED';
};

/**
 * A coordination list owns its tasks. A closed project freezes every link change,
 * including unlink. Other edits on an already linked task stay allowed.
 */
export function decideTaskProjectLink(input: {
  mode: 'create' | 'update';
  coordination: ProjectRef | null;
  current: ProjectRef | null;
  requested: ProjectRef | null | undefined;
}): LinkDecision {
  const { mode, coordination, current, requested } = input;
  if (coordination) {
    if (mode === 'create' && coordination.status === 'CLOSED') {
      return { projectId: undefined, error: 'CLOSED' };
    }
    if (requested && requested.id !== coordination.id) {
      if (
        coordination.status === 'CLOSED' ||
        requested.status === 'CLOSED' ||
        current?.status === 'CLOSED'
      ) {
        return { projectId: undefined, error: 'CLOSED' };
      }
      return { projectId: undefined, error: 'COORDINATION_LOCKED' };
    }
    if (requested === null) {
      if (coordination.status === 'CLOSED' || current?.status === 'CLOSED') {
        return { projectId: undefined, error: 'CLOSED' };
      }
      return { projectId: undefined, error: 'COORDINATION_LOCKED' };
    }
    if (current && current.status === 'CLOSED' && current.id !== coordination.id) {
      return { projectId: undefined, error: 'CLOSED' };
    }
    if (coordination.status === 'CLOSED') {
      return { projectId: undefined };
    }
    if (requested === undefined && mode === 'update' && current?.id === coordination.id) {
      return { projectId: undefined };
    }
    return { projectId: coordination.id };
  }

  if (mode === 'update' && requested === undefined) {
    return { projectId: undefined };
  }
  const next = requested ?? null;
  if (current?.status === 'CLOSED' && (next === null || next.id !== current.id)) {
    return { projectId: undefined, error: 'CLOSED' };
  }
  if (next && next.status === 'CLOSED' && next.id !== current?.id) {
    return { projectId: undefined, error: 'CLOSED' };
  }
  return { projectId: next ? next.id : null };
}

export function decideListMoveProject(input: {
  current: ProjectRef | null;
  targetCoordination: ProjectRef | null;
}): { projectId?: string; error?: 'CLOSED' } {
  const target = input.targetCoordination;
  if (!target) return {};
  if (target.status === 'CLOSED') return { error: 'CLOSED' };
  if (input.current?.status === 'CLOSED' && input.current.id !== target.id) {
    return { error: 'CLOSED' };
  }
  return { projectId: target.id };
}
