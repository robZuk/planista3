import client from './client'
import type { Instructor } from '../types'

export const instructorsApi = {
  getAll: (facultyId?: string) =>
    client.get<{ data: Instructor[] }>('/instructors', {
      params: facultyId ? { facultyId } : undefined,
    }),

  getOne: (id: string) =>
    client.get<{ data: Instructor }>(`/instructors/${id}`),

  create: (data: { firstName: string; lastName: string; email: string; title?: string; facultyId?: string }) =>
    client.post<{ data: Instructor }>('/instructors', data),

  update: (id: string, data: { firstName?: string; lastName?: string; email?: string; title?: string; facultyId?: string }) =>
    client.put<{ data: Instructor }>(`/instructors/${id}`, data),

  remove: (id: string) =>
    client.delete(`/instructors/${id}`),
}
