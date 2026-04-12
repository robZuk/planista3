import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SemesterType = 'WINTER' | 'SUMMER'

export const SEMESTER_TYPE_LABELS: Record<SemesterType, string> = {
  WINTER: 'Zimowy',
  SUMMER: 'Letni',
}

// Semestry zimowe = nieparzyste, letnie = parzyste
export const SEMESTER_TYPE_NUMBERS: Record<SemesterType, number[]> = {
  WINTER: [1, 3, 5, 7],
  SUMMER: [2, 4, 6],
}


interface AcademicYearStore {
  academicYear: string
  semesterType: SemesterType
  setAcademicYear: (year: string) => void
  setSemesterType: (type: SemesterType) => void
}

export const useAcademicYearStore = create<AcademicYearStore>()(
  persist(
    (set) => ({
      academicYear: '2024/2025',
      semesterType: 'WINTER',
      setAcademicYear: (academicYear) => set({ academicYear }),
      setSemesterType: (semesterType) => set({ semesterType }),
    }),
    { name: 'academic-year' }
  )
)
