import { GroupType } from '@prisma/client'

const EXERCISE_LABELS = ['A', 'B', 'C', 'D', 'E']
const LAB_SUFFIXES = ['1', '2', '3', '4']

export const generateGroupName = (
  fieldShortName: string,  // np. "EDST"
  studyYear: number,       // np. 1
  type: GroupType,
  index: number,           // 0, 1, 2...
  parentIndex?: number,    // dla LAB — indeks grupy ćwiczeniowej
): string => {
  const base = `${fieldShortName}-${studyYear}`
  switch (type) {
    case GroupType.LECTURE:  return `${base}-W`
    case GroupType.EXERCISE: return `${base}-C-${EXERCISE_LABELS[index]}`
    case GroupType.LAB:      return `${base}-L-${EXERCISE_LABELS[parentIndex!]}${LAB_SUFFIXES[index]}`
    case GroupType.PROJECT:  return `${base}-P-${EXERCISE_LABELS[index]}`
    case GroupType.SEMINAR:  return `${base}-S-${EXERCISE_LABELS[index]}`
  }
}
