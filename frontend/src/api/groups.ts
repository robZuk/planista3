import client from './client'
import type { StudentGroup, GroupProposal, GroupProposalItem, GroupType } from '../types'

export const groupsApi = {
  getAll: (params: { fieldOfStudyId?: string; semester?: number; academicYear?: string } = {}) =>
    client.get<{ data: StudentGroup[] }>('/groups', { params }),

  getOne: (id: string) =>
    client.get<{ data: StudentGroup }>(`/groups/${id}`),

  generate: (body: {
    fieldOfStudyId: string
    specializationId?: string
    studyYear: number
    semester: number
    academicYear: string
    totalStudents: number
  }) => client.post<{ data: GroupProposal }>('/groups/generate', body),

  confirm: (body: {
    fieldOfStudyId: string
    specializationId?: string
    studyYear: number
    semester: number
    academicYear: string
    proposal: GroupProposalItem[]
  }) => client.post<{ data: StudentGroup[] }>('/groups/confirm', body),

  update: (
    id: string,
    data: { name?: string; size?: number; preferredRoomId?: string | null }
  ) => client.put<{ data: StudentGroup }>(`/groups/${id}`, data),

  remove: (id: string) => client.delete(`/groups/${id}`),

  getGroupTypes: (): GroupType[] => ['LECTURE', 'EXERCISE', 'LAB', 'PROJECT', 'SEMINAR'],
}
