import { SprintEventType, TaskStatus } from '@prisma/client';

export type SprintPointEvent = {
  type: SprintEventType;
  taskId: string | null;
  storyPoints: number | null;
  createdAt: Date;
};

export type BurndownPoint = {
  date: string;
  remaining: number;
  scope: number;
  guideline: number;
};

export function sprintBurndown(input: {
  start: Date;
  end: Date;
  events: SprintPointEvent[];
  asOf: Date;
  businessDays: string[];
  metric: 'points' | 'count';
}): BurndownPoint[] {
  const committed = new Map<string, number>();
  const apply = (event: SprintPointEvent, sign: 1 | -1) => {
    if (!event.taskId) return;
    const amount = input.metric === 'count' ? 1 : (event.storyPoints ?? 0);
    const current = committed.get(event.taskId) ?? 0;
    committed.set(event.taskId, Math.max(0, current + sign * amount));
  };
  const ordered = [...input.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let cursor = 0;
  const replayUntil = (dayEnd: Date) => {
    while (cursor < ordered.length && ordered[cursor]!.createdAt.getTime() <= dayEnd.getTime()) {
      const event = ordered[cursor]!;
      if (event.type === SprintEventType.COMMITTED || event.type === SprintEventType.ADDED) apply(event, 1);
      if (event.type === SprintEventType.REMOVED) apply(event, -1);
      if (event.type === SprintEventType.ESTIMATE_CHANGED && event.taskId) {
        committed.set(event.taskId, input.metric === 'count' ? 1 : (event.storyPoints ?? 0));
      }
      if (event.type === SprintEventType.DONE) apply(event, -1);
      if (event.type === SprintEventType.REOPENED) apply(event, 1);
      cursor += 1;
    }
  };
  const total = () => [...committed.values()].reduce((sum, value) => sum + value, 0);
  const days = input.businessDays.length > 0 ? input.businessDays : [isoDay(input.start)];
  const startScopeEvents = ordered.filter(
    (event) =>
      event.createdAt.getTime() <= input.start.getTime() &&
      (event.type === SprintEventType.COMMITTED || event.type === SprintEventType.ADDED),
  );
  const opening = startScopeEvents.reduce(
    (sum, event) => sum + (input.metric === 'count' ? 1 : (event.storyPoints ?? 0)),
    0,
  );
  const span = Math.max(days.length - 1, 1);
  return days
    .filter((day) => day <= isoDay(input.asOf) || day <= isoDay(input.end))
    .map((day, index) => {
      const end = new Date(`${day}T23:59:59.999Z`);
      replayUntil(end);
      const remaining = total();
      const guideline = Math.max(0, opening - (opening / span) * index);
      return {
        date: day,
        remaining: round1(remaining),
        scope: round1(opening),
        guideline: round1(guideline),
      };
    });
}

export type VelocityBar = {
  sprintId: string;
  name: string;
  commitment: number;
  completed: number;
};

export function velocity(input: {
  sprints: Array<{ id: string; name: string; events: SprintPointEvent[] }>;
}): VelocityBar[] {
  return input.sprints.map((sprint) => {
    const commitment = sprint.events
      .filter((event) => event.type === SprintEventType.COMMITTED)
      .reduce((sum, event) => sum + (event.storyPoints ?? 0), 0);
    const completed = sprint.events
      .filter((event) => event.type === SprintEventType.CLOSED_DONE)
      .reduce((sum, event) => sum + (event.storyPoints ?? 0), 0);
    return {
      sprintId: sprint.id,
      name: sprint.name,
      commitment: round1(commitment),
      completed: round1(completed),
    };
  });
}

export type FlowPoint = { date: string; column: string; count: number };

export function cumulativeFlow(input: {
  days: string[];
  columns: string[];
  transitions: Array<{ taskId: string; toCategory: TaskStatus; toColumn: string; createdAt: Date }>;
}): { points: FlowPoint[]; approximate: boolean } {
  const state = new Map<string, string>();
  const ordered = [...input.transitions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let cursor = 0;
  const points: FlowPoint[] = [];
  for (const day of input.days) {
    const end = new Date(`${day}T23:59:59.999Z`);
    while (cursor < ordered.length && ordered[cursor]!.createdAt.getTime() <= end.getTime()) {
      const row = ordered[cursor]!;
      state.set(row.taskId, row.toColumn);
      cursor += 1;
    }
    const counts = new Map(input.columns.map((column) => [column, 0]));
    for (const column of state.values()) {
      if (!counts.has(column)) counts.set(column, 0);
      counts.set(column, (counts.get(column) ?? 0) + 1);
    }
    for (const [column, count] of counts) {
      points.push({ date: day, column, count });
    }
  }
  const approximate = input.transitions.some((row) => row.toColumn === '');
  return { points, approximate };
}

export type CycleSample = { taskId: string; days: number; doneAt: string };

export function cycleTimes(input: {
  transitions: Array<{
    taskId: string;
    toCategory: TaskStatus;
    createdAt: Date;
    reason: string;
  }>;
  window: number;
}): { samples: CycleSample[]; median: number | null; rolling: Array<{ index: number; average: number }>; approximate: boolean } {
  const byTask = new Map<string, { started: Date | null; done: Date | null; synthetic: boolean }>();
  const ordered = [...input.transitions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const row of ordered) {
    const slot = byTask.get(row.taskId) ?? { started: null, done: null, synthetic: false };
    if (row.reason === 'synthetic') slot.synthetic = true;
    if (row.toCategory === TaskStatus.IN_PROGRESS && !slot.started) slot.started = row.createdAt;
    if (row.toCategory === TaskStatus.DONE && slot.started && !slot.done) slot.done = row.createdAt;
    byTask.set(row.taskId, slot);
  }
  const samples: CycleSample[] = [];
  for (const [taskId, slot] of byTask) {
    if (!slot.started || !slot.done) continue;
    const days = (slot.done.getTime() - slot.started.getTime()) / 86_400_000;
    samples.push({ taskId, days: round1(Math.max(days, 0)), doneAt: slot.done.toISOString() });
  }
  samples.sort((a, b) => a.doneAt.localeCompare(b.doneAt));
  const median = samples.length === 0 ? null : samples[Math.floor(samples.length / 2)]!.days;
  const rolling: Array<{ index: number; average: number }> = [];
  for (let index = 0; index < samples.length; index += 1) {
    const slice = samples.slice(Math.max(0, index - input.window + 1), index + 1);
    const average = slice.reduce((sum, sample) => sum + sample.days, 0) / slice.length;
    rolling.push({ index, average: round1(average) });
  }
  return {
    samples,
    median,
    rolling,
    approximate: [...byTask.values()].some((slot) => slot.synthetic),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
