import client from './client'
import type { Faculty, FieldOfStudy, Specialization, CurriculumVersion, SemesterEntries } from '../types'

export const curriculumApi = {
  getFaculties: () =>
    client.get<{ data: Faculty[] }>('/faculties'),

  getFieldsOfStudy: (facultyId?: string) =>
    client.get<{ data: FieldOfStudy[] }>('/fields-of-study', {
      params: facultyId ? { facultyId } : undefined,
    }),

  getSpecializations: (fieldOfStudyId?: string) =>
    client.get<{ data: Specialization[] }>('/specializations', {
      params: fieldOfStudyId ? { fieldOfStudyId } : undefined,
    }),

  getAcademicYears: () =>
    client.get<{ data: string[] }>('/curriculum/academic-years'),

  getVersions: () =>
    client.get<{ data: CurriculumVersion[] }>('/curriculum/versions'),

  getEntries: (versionId: string, semester?: number) =>
    client.get<{ data: { version: CurriculumVersion; semesters: SemesterEntries[] } }>(
      `/curriculum/versions/${versionId}/entries`,
      { params: semester ? { semester } : undefined }
    ),

  createVersion: (body: {
    academicYear: string
    studyMode: string
    degreeLevel: string
    totalSemesters: number
    specializationId: string
  }) => client.post<{ data: CurriculumVersion }>('/curriculum/versions', body),

  updateVersion: (id: string, body: { totalSemesters?: number; isActive?: boolean }) =>
    client.put<{ data: CurriculumVersion }>(`/curriculum/versions/${id}`, body),

  deleteVersion: (versionId: string) =>
    client.delete<{ message: string }>(`/curriculum/versions/${versionId}`),

  addEntry: (versionId: string, body: {
    subjectId: string
    instructorId?: string
    semester: number
    orderInSemester: number
    hoursLecture?: number
    hoursExercise?: number
    hoursLab?: number
    hoursProject?: number
    hoursSeminar?: number
    ects?: number
    assessmentType?: string
  }) => client.post<{ data: unknown }>(`/curriculum/versions/${versionId}/entries`, body),

  deleteEntry: (entryId: string) =>
    client.delete(`/curriculum/entries/${entryId}`),

  getSubjects: (search?: string) =>
    client.get<{ data: { id: string; name: string; code?: string | null }[] }>('/subjects', {
      params: search ? { search } : undefined,
    }),

  updateEntry: (
    entryId: string,
    data: {
      hoursLecture?: number
      hoursExercise?: number
      hoursLab?: number
      hoursProject?: number
      hoursSeminar?: number
      ects?: number
      instructorId?: string | null
      assessmentType?: string
    }
  ) => client.put<{ data: unknown }>(`/curriculum/entries/${entryId}`, data),
}
