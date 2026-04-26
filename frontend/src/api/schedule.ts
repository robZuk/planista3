import client from './client'
import type { ScheduleTemplate, ScheduleEntry, SemesterCalendar, PublicHoliday, StudyMode, SemesterType } from '../types'

export const scheduleApi = {
  // ─── Wzorce tygodniowe ─────────────────────────────────────
  getTemplates: (params: { semester?: number; semesterType?: 'WINTER' | 'SUMMER'; academicYear?: string; studyMode?: StudyMode; studentGroupId?: string } = {}) =>
    client.get<{ data: ScheduleTemplate[] }>('/schedule/templates', { params }),

  getTemplate: (id: string) =>
    client.get<{ data: ScheduleTemplate }>(`/schedule/templates/${id}`),

  createTemplate: (data: {
    curriculumEntryId: string
    classType: string
    academicHours: number
    roomId: string
    instructorId: string
    studentGroupId?: string
    dayOfWeek: string
    startTime: string
    endTime: string
    semester: number
    academicYear: string
    weekType?: string
    studyMode?: string
  }) => client.post<{ data: ScheduleTemplate }>('/schedule/templates', data),

  updateTemplate: (id: string, data: Partial<{
    classType: string
    academicHours: number
    roomId: string
    instructorId: string
    studentGroupId: string | null
    dayOfWeek: string
    startTime: string
    endTime: string
    weekType: string
    studyMode: string
  }>) => client.put<{ data: ScheduleTemplate }>(`/schedule/templates/${id}`, data),

  deleteTemplate: (id: string) =>
    client.delete(`/schedule/templates/${id}`),

  deleteTemplates: (params: { semester?: number; academicYear?: string; studyMode?: StudyMode }) =>
    client.delete<{ data: { deleted: number } }>('/schedule/templates', { params }),

  getSummary: (curriculumVersionId: string) =>
    client.get<{ data: { semesters: Array<{ semester: number; subjects: Array<{ subjectName: string; classType: string; planned: number; required: number; remaining: number; completed: boolean }> }> } }>(
      `/schedule/summary/${curriculumVersionId}`
    ),

  // ─── Generator ────────────────────────────────────────────
  generateTemplate: (params: {
    facultyId?: string
    fieldOfStudyId?: string
    specializationId?: string
    semester?: number
    semesterType?: 'WINTER' | 'SUMMER'
    academicYear: string
    studyMode?: StudyMode
  }) => client.post<{ data: object[]; meta: { total: number } }>('/schedule/generate-template', params),

  generateSemester: (data: { templateIds: string[]; academicYear: string; semesterType: string; studyMode: string }) =>
    client.post<{ data: { created: number; skipped: number; conflicts: number }; details: object; message: string }>(
      '/schedule/generate-semester',
      data
    ),

  // ─── Konkretne terminy ─────────────────────────────────────
  getEntries: (params: { from?: string; to?: string; studentGroupId?: string; instructorId?: string; status?: string } = {}) =>
    client.get<{ data: ScheduleEntry[] }>('/schedule/entries', { params }),

  getEntry: (id: string) =>
    client.get<{ data: ScheduleEntry }>(`/schedule/entries/${id}`),

  createEntry: (data: {
    date: string
    startTime: string
    endTime: string
    classType: string
    academicHours: number
    roomId: string
    instructorId: string
    curriculumEntryId: string
    studentGroupId?: string
    templateId?: string
    status?: string
  }) => client.post<{ data: ScheduleEntry }>('/schedule/entries', data),

  updateEntry: (id: string, data: Partial<{
    roomId: string
    instructorId: string
    date: string
    startTime: string
    endTime: string
    status: string
    scope: 'ONE' | 'ALL'
  }>) => client.put<{ data: ScheduleEntry }>(`/schedule/entries/${id}`, data),

  deleteEntry: (id: string, cancel?: boolean) =>
    client.delete(`/schedule/entries/${id}`, { params: cancel ? { cancel: 'true' } : undefined }),

  deleteEntries: (params: { from?: string; to?: string; studentGroupId?: string; instructorId?: string; templateId?: string }) =>
    client.delete<{ data: { deleted: number } }>('/schedule/entries', { params }),

  moveEntry: (id: string, data: {
    newDate: string
    newStartTime: string
    newEndTime: string
    newRoomId?: string
    newInstructorId?: string
    scope: 'ONE' | 'ALL'
  }) => client.post<{ data: ScheduleEntry | { updatedCount: number }; message: string }>(
    `/schedule/entries/${id}/move`,
    data
  ),

  // ─── Kalendarze semestrów ──────────────────────────────────
  getCalendars: () =>
    client.get<{ data: SemesterCalendar[] }>('/schedule/calendars'),

  getCalendar: (id: string) =>
    client.get<{ data: SemesterCalendar }>(`/schedule/calendars/${id}`),

  createCalendar: (data: {
    academicYear: string
    semesterType: SemesterType
    studyMode: StudyMode
    startDate: string
    endDate: string
    teachingWeeks: number
  }) => client.post<{ data: SemesterCalendar }>('/schedule/calendars', data),

  updateCalendar: (id: string, data: Partial<{ startDate: string; endDate: string; teachingWeeks: number }>) =>
    client.put<{ data: SemesterCalendar }>(`/schedule/calendars/${id}`, data),

  deleteCalendar: (id: string) =>
    client.delete(`/schedule/calendars/${id}`),

  // ─── Dni wolne ─────────────────────────────────────────────
  getHolidays: (params?: { from?: string; to?: string }) =>
    client.get<{ data: PublicHoliday[] }>('/schedule/holidays', { params }),

  createHoliday: (data: { date: string; name: string }) =>
    client.post<{ data: PublicHoliday }>('/schedule/holidays', data),

  deleteHoliday: (id: string) =>
    client.delete(`/schedule/holidays/${id}`),
}
