export type Role = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT' | 'DEAN_OFFICE'
export type StudyMode = 'FULL_TIME' | 'PART_TIME'
export type ClassType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'PROJECT' | 'SEMINAR'
export type GroupType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'PROJECT' | 'SEMINAR'
export type RoomType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'COMPUTER_LAB' | 'SEMINAR' | 'SPORTS'
export type AssessmentType = 'EXAM' | 'CREDIT'
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

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
  specialization?: Specialization
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

export interface ScheduleEntry {
  id: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  academicHours: number
  classType: ClassType
  academicYear: string
  semester: number
  weekType: 'EVERY' | 'EVEN' | 'ODD'
  room: { id: string; number: string; building: { name: string } }
  instructor: { id: string; firstName: string; lastName: string }
  studentGroup?: { id: string; name: string } | null
  curriculumEntry: { subject: { name: string } }
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
