export type Role = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT' | 'DEAN_OFFICE'
export type StudyMode = 'FULL_TIME' | 'PART_TIME'
export type ClassType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'PROJECT' | 'SEMINAR'
export type GroupType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'PROJECT' | 'SEMINAR'
export type RoomType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'COMPUTER_LAB' | 'SEMINAR' | 'SPORTS'
export type AssessmentType = 'EXAM' | 'CREDIT'
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
export type WeekType = 'EVERY' | 'EVEN' | 'ODD'
export type EntryStatus = 'SCHEDULED' | 'CANCELLED' | 'MAKEUP'
export type SemesterType = 'WINTER' | 'SUMMER'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  instructorId?: string | null
  studentGroupId?: string | null
}

export interface Faculty {
  id: string
  name: string
  shortName: string
}

export interface FieldOfStudy {
  id: string
  name: string
  shortName: string
  facultyId: string
  specializations?: Specialization[]
}

export interface Specialization {
  id: string
  name: string
  shortName: string
  fieldOfStudyId: string
  curriculumVersions?: CurriculumVersion[]
}

export interface CurriculumVersion {
  id: string
  academicYear: string
  studyMode: StudyMode
  isActive: boolean
  totalSemesters: number
  specialization?: Specialization & {
    fieldOfStudy?: FieldOfStudy & { faculty?: Faculty }
  }
  _count?: { entries: number }
}

export interface CurriculumEntry {
  id: string
  semester: number
  orderInSemester: number
  hoursLecture: number
  hoursExercise: number
  hoursLab: number
  hoursProject: number
  hoursSeminar: number
  totalHours: number
  ects: number
  assessmentType: AssessmentType
  subject: { id: string; name: string; code?: string | null }
  instructor?: { id: string; firstName: string; lastName: string; title?: string | null } | null
}

export interface SemesterEntries {
  semester: number
  totalEcts: number
  entries: CurriculumEntry[]
}

// ─── Wzorzec tygodniowy ────────────────────────────────────────

export interface ScheduleTemplate {
  id: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  academicHours: number
  classType: ClassType
  weekType: WeekType
  studyMode: StudyMode
  semester: number
  academicYear: string
  room: {
    id: string
    number: string
    type: RoomType
    capacity: number
    building: { id: string; name: string }
  }
  instructor: { id: string; firstName: string; lastName: string; title?: string | null }
  studentGroup?: { id: string; name: string } | null
  curriculumEntry: {
    id: string
    subject: { id: string; name: string }
    hoursLecture: number
    hoursExercise: number
    hoursLab: number
    hoursProject: number
    hoursSeminar: number
  }
}

// ─── Konkretny termin ─────────────────────────────────────────

export interface ScheduleEntry {
  id: string
  date: string             // ISO date string "2025-10-07T00:00:00.000Z"
  startTime: string
  endTime: string
  status: EntryStatus
  classType: ClassType
  academicHours: number
  templateId?: string | null
  template?: { id: string; dayOfWeek: DayOfWeek; weekType: WeekType } | null
  room: { id: string; number: string; building: { id: string; name: string } }
  instructor: { id: string; firstName: string; lastName: string; title?: string | null }
  studentGroup?: { id: string; name: string } | null
  curriculumEntry: { id: string; subject: { id: string; name: string } }
}

// ─── Kalendarz semestru ───────────────────────────────────────

export interface SemesterCalendar {
  id: string
  academicYear: string
  semesterType: SemesterType
  studyMode: StudyMode
  startDate: string
  endDate: string
  teachingWeeks: number
}

// ─── Dzień wolny ──────────────────────────────────────────────

export interface PublicHoliday {
  id: string
  date: string
  name: string
}

export interface StudentGroup {
  id: string
  name: string
  type: GroupType
  size: number
  studyYear: number
  semester: number
  academicYear: string
  fieldOfStudyId: string
  specializationId?: string | null
  parentGroupId?: string | null
  preferredRoomId?: string | null
  subGroups?: StudentGroup[]
  parentGroup?: { id: string; name: string } | null
  preferredRoom?: { id: string; number: string; building: { name: string } } | null
}

export interface GroupProposalItem {
  name: string
  type: GroupType
  size: number
  parentName: string | null
  semester: number
  studyYear: number
}

export interface Room {
  id: string
  number: string
  type: RoomType
  capacity: number
  buildingId: string
}

export interface Building {
  id: string
  name: string
  address?: string | null
  facultyId?: string | null
  faculty?: { id: string; name: string; shortName: string } | null
  rooms: Room[]
}

export interface Instructor {
  id: string
  firstName: string
  lastName: string
  email: string
  title?: string | null
  facultyId?: string | null
  faculty?: { id: string; name: string; shortName: string } | null
}

export interface GroupProposal {
  proposal: GroupProposalItem[]
  meta: {
    totalStudents: number
    semester: number
    academicYear: string
    groupCounts: Record<GroupType, number>
  }
}
