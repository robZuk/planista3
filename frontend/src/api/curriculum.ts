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

  getVersions: () =>
    client.get<{ data: CurriculumVersion[] }>('/curriculum/versions'),

  getEntries: (versionId: string, semester?: number) =>
    client.get<{ data: { version: CurriculumVersion; semesters: SemesterEntries[] } }>(
      `/curriculum/versions/${versionId}/entries`,
      { params: semester ? { semester } : undefined }
    ),

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
