import client from './client'
import type { ScheduleEntry } from '../types'

export const scheduleApi = {
  getAll: (params: { semester?: number; academicYear?: string } = {}) =>
    client.get<{ data: ScheduleEntry[] }>('/schedule', { params }),

  getOne: (id: string) =>
    client.get<{ data: ScheduleEntry }>(`/schedule/${id}`),

  remove: (id: string) =>
    client.delete(`/schedule/${id}`),
}
