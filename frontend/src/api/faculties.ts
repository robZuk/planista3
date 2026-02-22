import client from './client'
import type { Faculty, FieldOfStudy, Specialization } from '../types'

export const facultiesApi = {
  getAll: () =>
    client.get<{ data: Faculty[] }>('/faculties'),

  create: (data: { name: string; shortName: string }) =>
    client.post<{ data: Faculty }>('/faculties', data),

  update: (id: string, data: { name?: string; shortName?: string }) =>
    client.put<{ data: Faculty }>(`/faculties/${id}`, data),

  remove: (id: string) =>
    client.delete(`/faculties/${id}`),
}

export const fieldsApi = {
  getAll: (facultyId?: string) =>
    client.get<{ data: FieldOfStudy[] }>('/fields-of-study', {
      params: facultyId ? { facultyId } : undefined,
    }),

  create: (data: { name: string; shortName: string; facultyId: string }) =>
    client.post<{ data: FieldOfStudy }>('/fields-of-study', data),

  update: (id: string, data: { name?: string; shortName?: string }) =>
    client.put<{ data: FieldOfStudy }>(`/fields-of-study/${id}`, data),

  remove: (id: string) =>
    client.delete(`/fields-of-study/${id}`),
}

export const specsApi = {
  getAll: (fieldOfStudyId?: string) =>
    client.get<{ data: Specialization[] }>('/specializations', {
      params: fieldOfStudyId ? { fieldOfStudyId } : undefined,
    }),

  create: (data: { name: string; shortName: string; fieldOfStudyId: string }) =>
    client.post<{ data: Specialization }>('/specializations', data),

  update: (id: string, data: { name?: string; shortName?: string }) =>
    client.put<{ data: Specialization }>(`/specializations/${id}`, data),

  remove: (id: string) =>
    client.delete(`/specializations/${id}`),
}
