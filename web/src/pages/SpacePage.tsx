import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Folder } from '../lib/icons'
import { useStore } from '../store'

export function SpacePage() {
  const { spaceId } = useParams()
  const store = useStore()
  const space = store.spaces.find((item) => item.id === spaceId)

  if (!store.ready) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
      </div>
    )
  }

  if (!space) {
    return (
      <EmptyState icon={Folder} title="Пространство не найдено" description="Проверьте ссылку или права доступа." />
    )
  }

  const folders = store.folders.filter((item) => item.spaceId === space.id)
  const lists = store.lists.filter((item) => item.spaceId === space.id)
  const rootLists = lists.filter((list) => !list.folderId)

  return (
    <div className="space-y-6">
      <PageHeader
        overline={space.isSystem ? 'System space' : 'Space'}
        title={space.name}
        subtitle={space.description || undefined}
      />

      {rootLists.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rootLists.map((list) => (
            <ListCard key={list.id} listId={list.id} name={list.name} />
          ))}
        </div>
      ) : null}

      {folders.map((folder) => {
        const folderLists = lists.filter((list) => list.folderId === folder.id)
        if (folderLists.length === 0) return null
        return (
          <section key={folder.id} className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">{folder.name}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folderLists.map((list) => (
                <ListCard key={list.id} listId={list.id} name={list.name} />
              ))}
            </div>
          </section>
        )
      })}

      {rootLists.length === 0 && folders.every((f) => lists.filter((l) => l.folderId === f.id).length === 0) ? (
        <EmptyState icon={Folder} title="Списков пока нет" description="Создайте список в этом пространстве." />
      ) : null}
    </div>
  )
}

function ListCard({ listId, name }: { listId: string; name: string }) {
  const store = useStore()
  const open = store.tasks.filter(
    (task) => task.listId === listId && !task.parentTaskId && task.status !== 'DONE' && task.status !== 'CANCELLED',
  ).length
  const starred = store.favorites.some((item) => item.entityType === 'TASK_LIST' && item.entityId === listId)
  return (
    <Link to={`/lists/${listId}`} className="surface-card block rounded p-4 transition-colors hover:bg-elevated">
      <h3 className="font-medium text-foreground">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{open} открытых</p>
      <span className="mt-2 inline-block text-xs text-subtle-foreground">
        {starred ? 'в избранном' : 'открыть'}
      </span>
    </Link>
  )
}
