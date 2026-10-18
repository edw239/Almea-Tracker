import { api } from './api'
import type { SprintRow } from './board-types'
import type { TaskList } from '../types'

export type EpicOption = { id: string; title: string }

const EPIC_PAGE_LIMIT = 100

export async function loadSpaceEpics(spaceId: string, lists: TaskList[]): Promise<EpicOption[]> {
  const types = await api.listTaskTypes(spaceId)
  const epicType = types.find((type) => type.key === 'epic')
  if (!epicType) return []
  const filter = JSON.stringify({
    op: 'AND',
    children: [{ field: 'task_type_id', operator: 'is', value: epicType.id }],
  })
  const pages = await Promise.all(
    lists
      .filter((list) => list.spaceId === spaceId)
      .map((list) => api.listTasks(list.id, { filters: filter, limit: EPIC_PAGE_LIMIT })),
  )
  return pages.flatMap((page) =>
    page.items.map((item) => ({
      id: item.id,
      title: item.key ? `${item.key} ${item.title}` : item.title,
    })),
  )
}

export async function loadSpaceSprints(spaceId: string, lists: TaskList[]): Promise<SprintRow[]> {
  const inSpace = lists.filter((list) => list.spaceId === spaceId)
  const listIds = new Set(inSpace.map((list) => list.id))
  const folderIds = new Set(inSpace.flatMap((list) => (list.folderId ? [list.folderId] : [])))
  const boards = await api.boards()
  const matched = boards.filter(
    (board) =>
      board.type === 'SCRUM' &&
      board.sources.some(
        (source) =>
          source.spaceId === spaceId ||
          (source.listId != null && listIds.has(source.listId)) ||
          (source.folderId != null && folderIds.has(source.folderId)),
      ),
  )
  const groups = await Promise.all(matched.map((board) => api.boardSprints(board.id)))
  const seen = new Set<string>()
  const rows: SprintRow[] = []
  for (const group of groups) {
    for (const sprint of group) {
      if (seen.has(sprint.id) || sprint.state === 'CLOSED') continue
      seen.add(sprint.id)
      rows.push(sprint)
    }
  }
  return rows
}
