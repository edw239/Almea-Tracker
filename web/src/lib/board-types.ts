export type BoardSummary = {
  id: string
  name: string
  type: 'KANBAN' | 'SCRUM'
  ownerId: string
  backlogEnabled: boolean
  sources: Array<{ id: string; spaceId: string | null; folderId: string | null; listId: string | null }>
}

export type BoardDetail = BoardSummary & {
  swimlaneBy: string
  doneHideDays: number | null
  defaultListId: string | null
  cardColorBy: string
  cardFields: string[] | null
  filter: unknown
  swimlaneQueries?: unknown
  columns?: BoardColumnInput[]
  quickFilters?: Array<{ id: string; name: string; filter: unknown }>
}

export type CreateBoardBody = {
  name: string
  type: 'KANBAN' | 'SCRUM'
  sources: Array<{ spaceId?: string; folderId?: string; listId?: string }>
  filter?: unknown
  swimlaneBy?: string
  defaultListId?: string
}

export type BoardColumnInput = {
  id?: string
  name: string
  statusNames: string[]
  minWip?: number | null
  maxWip?: number | null
  position?: number
  count?: number
}

export type BoardCard = {
  id: string
  key: string
  title: string
  priority: string
  statusName: string
  rank: string
  listId: string
  assigneeIds: string[]
  dueDate: string | null
  domainLabel: string | null
  hostEntityId: string | null
  isStuck: boolean
  taskTypeName: string | null
  taskTypeColor: string | null
  epicId: string | null
  epicKey: string | null
  epicTitle: string | null
  epicColor: string | null
  storyPoints: number | null
  labels: Array<{ id: string; name: string }>
  checklistDone: number
  checklistTotal: number
  subtaskDone: number
  subtaskTotal: number
  daysInColumn: number
  availableColumnIds: string[]
  canMove: boolean
  canEdit: boolean
  columnId: string
  laneKey: string
  sprintId: string | null
}

export type BoardViewPayload = {
  board: {
    id: string
    name: string
    type: 'KANBAN' | 'SCRUM'
    swimlaneBy: string
    backlogEnabled: boolean
    doneHideDays: number | null
    cardColorBy: string
    cardFields: unknown
    defaultListId: string | null
  }
  columns: BoardColumnInput[]
  lanes: Array<{ key: string; label: string }>
  cards: BoardCard[]
  unmapped: Array<{ name: string; count: number }>
  truncated: boolean
  activeSprint: {
    id: string
    name: string
    goal: string | null
    startDate: string | null
    endDate: string | null
    daysLeft: number | null
  } | null
  quickFilters: Array<{ id: string; name: string; filter: unknown }>
}

export type BacklogTask = {
  id: string
  key: string
  title: string
  rank: string
  priority: string
  storyPoints: number | null
  epicId: string | null
  epicTitle: string | null
  epicColor: string | null
  sprintId: string | null
  assigneeIds: string[]
}

export type BoardBacklogPayload = {
  tasks: BacklogTask[]
  sprints: Array<{
    id: string
    name: string
    state: string
    goal: string | null
    endDate: string | null
    points: number
    tasks: BacklogTask[]
  }>
  epics: Array<{ id: string; key: string; title: string; color: string; storyPoints: number | null }>
}

export type SprintRow = { id: string; name: string; state: string; goal: string | null; endDate: string | null }

export type BurndownPayload = {
  metric: string
  approximate: boolean
  points: Array<{ date: string; remaining: number; scope: number; guideline: number }>
}

export type SprintReportPayload = {
  sprint: { id: string; name: string; goal: string | null; state: string }
  commitment: number
  completed: number
  incomplete: number
  added: number
  removed: number
  approximate: boolean
}
