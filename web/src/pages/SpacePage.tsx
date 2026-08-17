import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store'

export function SpacePage() {
  const { spaceId } = useParams()
  const store = useStore()
  const space = store.spaces.find((item) => item.id === spaceId)
  if (!store.ready) return <p className="content">Загрузка…</p>
  if (!space) return <p className="content">Пространство не найдено</p>

  const folders = store.folders.filter((item) => item.spaceId === space.id)
  const lists = store.lists.filter((item) => item.spaceId === space.id)

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">{space.isSystem ? 'System space' : 'Space'}</div>
          <h1 className="page-title">{space.name}</h1>
          <p className="page-lead">{space.description}</p>
        </div>
      </header>
      <div className="content">
        {lists.filter((list) => !list.folderId).length > 0 ? (
          <div className="space-grid">
            {lists
              .filter((list) => !list.folderId)
              .map((list) => (
                <ListCard key={list.id} listId={list.id} name={list.name} />
              ))}
          </div>
        ) : null}
        {folders.map((folder) => (
          <section className="group" key={folder.id}>
            <div className="group-h">
              <h2>{folder.name}</h2>
            </div>
            <div className="space-grid">
              {lists
                .filter((list) => list.folderId === folder.id)
                .map((list) => (
                  <ListCard key={list.id} listId={list.id} name={list.name} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function ListCard({ listId, name }: { listId: string; name: string }) {
  const store = useStore()
  const open = store.tasks.filter(
    (task) => task.listId === listId && !task.parentTaskId && task.status !== 'DONE' && task.status !== 'CANCELLED',
  ).length
  const starred = store.favorites.some((item) => item.entityType === 'TASK_LIST' && item.entityId === listId)
  return (
    <Link to={`/lists/${listId}`} className="space-card">
      <h3>{name}</h3>
            <p>{open} открытых</p>
      <span>{starred ? 'в избранном' : 'открыть'}</span>
    </Link>
  )
}
