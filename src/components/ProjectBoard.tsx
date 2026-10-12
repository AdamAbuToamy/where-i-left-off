import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import type { Project, Section, GroupMember } from '../types'
import type { Language } from '../translations'
import ProjectCard from './ProjectCard'
import './ProjectBoard.css'
import type { ProjectDetails } from '../lib/projects'

const messages = {
  ar: {
    handle: 'اسحب لتغيير الترتيب',
    hint: 'رتّب مشاريعك بالسحب من مقبض النقاط',
    instructions:
      'اضغط المسافة لبدء السحب، ثم الأسهم للتحريك، والمسافة للإفلات أو Escape للإلغاء.',
    picked: 'تم التقاط',
    position: 'الموضع',
    dropped: 'تم نقل',
    cancelled: 'تم إلغاء السحب',
  },
  he: {
    handle: 'גרירה לשינוי הסדר',
    hint: 'סידור הפרויקטים בגרירה באמצעות ידית הנקודות',
    instructions:
      'לחצו על רווח להתחלת הגרירה, על החצים להזזה, על רווח לשחרור או על Escape לביטול.',
    picked: 'נבחר לגרירה',
    position: 'מיקום',
    dropped: 'הועבר',
    cancelled: 'הגרירה בוטלה',
  },
  en: {
    handle: 'Drag to reorder',
    hint: 'Reorder projects using the dotted handle',
    instructions:
      'Press Space to pick up, arrow keys to move, Space to drop, or Escape to cancel.',
    picked: 'Picked up',
    position: 'Position',
    dropped: 'Moved',
    cancelled: 'Drag cancelled',
  },
}

type ProjectBoardProps = {
  projects: Project[]
  sections: Section[]
  language: Language
  members?: GroupMember[]
  currentUid?: string
  canManage?: boolean
  onReorder: (activeId: string, overId: string) => void
  onToggle: (id: string) => void
  onUpdate: (id: string, name: string, nextStep: string, details: ProjectDetails, revision: number) => Promise<boolean>
  onDelete: (id: string, revision: number) => Promise<boolean>
}

type SortableCardProps = Omit<
  ProjectBoardProps,
  'projects' | 'onReorder'
> & {
  project: Project
}

function SortableCard({
  project,
  sections,
  language,
  members, currentUid, canManage = true,
  onToggle,
  onUpdate,
  onDelete,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: !canManage })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-project ${isDragging ? 'is-dragging' : ''}`}
    >
      {canManage && <button
        ref={setActivatorNodeRef}
        type="button"
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`${messages[language].handle}: ${project.name}`}
        title={messages[language].handle}
      >
        <svg
          width="22"
          height="26"
          viewBox="0 0 22 26"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="7" cy="6" r="2" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="7" cy="13" r="2" />
          <circle cx="15" cy="13" r="2" />
          <circle cx="7" cy="20" r="2" />
          <circle cx="15" cy="20" r="2" />
        </svg>
      </button>}

      <ProjectCard
        project={project}
        members={members} canManage={canManage} canEdit={canManage || project.assignedTo === currentUid}
        sections={sections}
        language={language}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  )
}

export default function ProjectBoard({
  projects,
  sections,
  language,
  members, currentUid, canManage = true,
  onReorder,
  onToggle,
  onUpdate,
  onDelete,
}: ProjectBoardProps) {
  const t = messages[language]

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function nameOf(id: string | number) {
    return projects.find((project) => project.id === String(id))?.name ?? ''
  }

  function positionOf(id: string | number) {
    return projects.findIndex((project) => project.id === String(id)) + 1
  }

  return (
    <div className="project-board">
      {canManage && <p className="board-hint">{t.hint}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: {
            draggable: t.instructions,
          },
          announcements: {
            onDragStart({ active }) {
              return `${t.picked}: ${nameOf(active.id)}`
            },
            onDragOver({ active, over }) {
              if (!over) return
              return `${nameOf(active.id)}. ${t.position}: ${positionOf(over.id)}`
            },
            onDragEnd({ active, over }) {
              if (!over) return t.cancelled
              return `${t.dropped}: ${nameOf(active.id)}. ${t.position}: ${positionOf(over.id)}`
            },
            onDragCancel() {
              return t.cancelled
            },
          },
        }}
        onDragEnd={({ active, over }) => {
          if (canManage && over && active.id !== over.id) {
            onReorder(String(active.id), String(over.id))
          }
        }}
      >
        <SortableContext
          items={projects.map((project) => project.id)}
          strategy={rectSortingStrategy}
        >
          <section className="projects-grid">
            {projects.map((project) => (
              <SortableCard
                key={project.id}
                project={project}
                members={members} currentUid={currentUid} canManage={canManage}
                sections={sections}
                language={language}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </section>
        </SortableContext>
      </DndContext>
    </div>
  )
}
