import type { Project } from '../types'
import { DomainError } from './appError'
import { validateProject } from './projects'
import type { ProjectDetails } from './projects'
import { normalizedProject } from './workspaceModel'
import { completionDates } from './workflow'

export type ProjectOperation = 'edit' | 'toggle' | 'delete' | 'move'
export type ProjectChanges = ProjectDetails & { name?: string; nextStep?: string; rank?: number }

/** Domain behavior only: no React, storage, network, or clock reads. */
export class ProjectEntity {
  private readonly data: Project

  private constructor(value: Project) {
    validateProject(value.name, value.nextStep, value)
    if (!value.id || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new DomainError('invalid-project')
    if (!Number.isFinite(value.rank) || Math.abs(value.rank) >= 1e15) throw new DomainError('order-limit')
    this.data = normalizedProject(value.id, value)
  }

  static restore(value: Project): ProjectEntity {
    return new ProjectEntity(normalizedProject(value.id, value))
  }

  static create(id: string, name: string, nextStep: string, rank: number, details: ProjectDetails, now: number): ProjectEntity {
    validateProject(name, nextStep, details)
    return new ProjectEntity(normalizedProject(id, {
      ...details, name: name.trim(), nextStep: nextStep.trim(), rank, revision: 0,
      activityAt: now, completedAt: details.status === 'done' ? now : 0,
    }))
  }

  apply(operation: ProjectOperation, values: ProjectChanges, expectedRevision: number, now: number): ProjectEntity | null {
    if ((operation === 'edit' || operation === 'delete') && this.data.revision !== expectedRevision) throw new DomainError('conflict')
    if (operation === 'delete') return null
    const next = { ...this.data, revision: this.data.revision + 1 }
    if (operation === 'toggle') next.status = next.status === 'active' ? 'later' : 'active'
    else if (operation === 'move') {
      if (values.rank === undefined) throw new DomainError('order-limit')
      next.rank = values.rank
    } else {
      Object.assign(next, values)
      // Identity and revision cannot be changed by an edit payload.
      next.id = this.data.id
      next.revision = this.data.revision + 1
      next.name = (values.name ?? this.data.name).trim()
      next.nextStep = (values.nextStep ?? this.data.nextStep).trim()
    }
    return new ProjectEntity(completionDates(this.data, next, now))
  }

  snapshot(): Project { return { ...this.data, links: [...(this.data.links || [])] } }
}
