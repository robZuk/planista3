import client from './client'
import type { StudentGroup, GroupProposal, GroupProposalItem, GroupType } from '../types'

export const groupsApi = {
  getAll: (params: { fieldOfStudyId?: string; specializationId?: string; semester?: number; academicYear?: string; semesterType?: 'WINTER' | 'SUMMER' } = {}) =>
    client.get<{ data: StudentGroup[] }>('/groups', { params }),

  getOne: (id: string) =>
    client.get<{ data: StudentGroup }>(`/groups/${id}`),

  generate: (body: {
    fieldOfStudyId: string
    specializationId?: string
    semester?: number
    semesterType?: 'WINTER' | 'SUMMER'
    academicYear: string
    totalStudents: number
    studyMode?: string
  }) => client.post<{ data: GroupProposal }>('/groups/generate', body),

  confirm: (body: {
    fieldOfStudyId: string
    specializationId?: string
    academicYear: string
    studyMode?: string
    proposal: GroupProposalItem[]
  }) => client.post<{ data: StudentGroup[] }>('/groups/confirm', body),

  update: (
    id: string,
    data: { name?: string; size?: number; preferredRoomId?: string | null }
  ) => client.put<{ data: StudentGroup }>(`/groups/${id}`, data),

  remove: (id: string) => client.delete(`/groups/${id}`),

  removeAll: (academicYear?: string) =>
    client.delete('/groups', { params: academicYear ? { academicYear } : undefined }),

  create: (body: {
    name: string
    type: GroupType
    size: number
    fieldOfStudyId: string
    specializationId?: string
    studyYear: number
    semester: number
    academicYear: string
    parentGroupId?: string
  }) => client.post<{ data: StudentGroup }>('/groups', body),

  getGroupTypes: (): GroupType[] => ['LECTURE', 'EXERCISE', 'LAB', 'PROJECT', 'SEMINAR'],
}
