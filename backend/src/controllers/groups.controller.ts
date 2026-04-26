import { Request, Response } from 'express'
import { GroupType, RoomType } from '@prisma/client'
import prisma from '../lib/prisma'
import { isNotFoundError, isUniqueConstraintError } from '../lib/prismaErrors'
import { generateGroupName } from '../lib/groupNaming'

// Typy sal używane do wyznaczenia liczby grup (tylko naturalne/pierwotne typy)
// Nie uwzględniamy sal zastępczych (np. LECTURE dla EXERCISE), żeby nie zaniżać groupCount
const primaryRoomTypeMap: Record<GroupType, RoomType[]> = {
  LECTURE:  [RoomType.LECTURE],
  EXERCISE: [RoomType.EXERCISE],
  LAB:      [RoomType.LAB, RoomType.COMPUTER_LAB],
  PROJECT:  [RoomType.EXERCISE, RoomType.COMPUTER_LAB],
  SEMINAR:  [RoomType.SEMINAR],
}


// GET /api/groups
export const getAll = async (req: Request, res: Response) => {
  try {
    const { fieldOfStudyId, specializationId, semester, academicYear, semesterType } = req.query
    const semesterFilter = semester
      ? { semester: Number(semester) }
      : semesterType === 'WINTER'
        ? { semester: { in: [1, 3, 5, 7] } }
        : semesterType === 'SUMMER'
          ? { semester: { in: [2, 4, 6] } }
          : {}
    const data = await prisma.studentGroup.findMany({
      where: {
        ...(fieldOfStudyId ? { fieldOfStudyId: String(fieldOfStudyId) } : {}),
        ...(specializationId ? { specializationId: String(specializationId) } : {}),
        ...semesterFilter,
        ...(academicYear ? { academicYear: String(academicYear) } : {}),
      },
      include: {
        subGroups: { include: { subGroups: true } },
        preferredRoom: { include: { building: { select: { name: true } } } },
      },
      orderBy: [{ semester: 'asc' }, { type: 'asc' }, { name: 'asc' }],
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// GET /api/groups/:id
export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.studentGroup.findUnique({
      where: { id: req.params.id },
      include: {
        subGroups: { include: { subGroups: true } },
        parentGroup: true,
        preferredRoom: { include: { building: { select: { name: true } } } },
        fieldOfStudy: { select: { name: true, shortName: true } },
        specialization: { select: { name: true, shortName: true } },
      },
    })
    if (!data) return res.status(404).json({ error: 'Grupa nie znaleziona' })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

type ProposalEntry = {
  name: string
  type: GroupType
  size: number
  parentName: string | null
  semester: number
  studyYear: number
}

async function generateForSemester(
  sem: number,
  groupPrefix: string,
  totalStudents: number,
  facultyId: string,
  classTypes: Set<GroupType>,
): Promise<ProposalEntry[]> {
  const studyYear = Math.ceil(sem / 2)
  const proposal: ProposalEntry[] = []
  const groupCounts: Partial<Record<GroupType, number>> = {}

  const orderedTypes: GroupType[] = [
    GroupType.LECTURE,
    GroupType.EXERCISE,
    GroupType.LAB,
    GroupType.PROJECT,
    GroupType.SEMINAR,
  ]

  for (const groupType of orderedTypes) {
    if (!classTypes.has(groupType)) continue

    const buildingFilter = {
      OR: [
        { building: { facultyId } },
        { building: { facultyId: null } },
      ],
    }

    let largestRoom = await prisma.room.findFirst({
      where: { type: { in: primaryRoomTypeMap[groupType] }, ...buildingFilter },
      orderBy: { capacity: 'desc' },
    })

    // Fallback dla wykładu: brak sali wykładowej → użyj największej ćwiczeniowej,
    // ale tylko jeśli wszyscy studenci się w niej zmieszczą
    if (groupType === GroupType.LECTURE && !largestRoom) {
      const largestExerciseRoom = await prisma.room.findFirst({
        where: { type: RoomType.EXERCISE, ...buildingFilter },
        orderBy: { capacity: 'desc' },
      })
      if (largestExerciseRoom && largestExerciseRoom.capacity >= totalStudents) {
        largestRoom = largestExerciseRoom
      }
    }

    const roomCapacity = largestRoom?.capacity ?? totalStudents
    const groupCount = Math.ceil(totalStudents / roomCapacity)
    const groupSize = Math.ceil(totalStudents / groupCount)
    groupCounts[groupType] = groupCount

    if (groupType === GroupType.LECTURE) {
      proposal.push({ name: generateGroupName(groupPrefix, sem, GroupType.LECTURE, 0), type: GroupType.LECTURE, size: totalStudents, parentName: null, semester: sem, studyYear })
    } else if (groupType === GroupType.EXERCISE) {
      for (let i = 0; i < groupCount; i++) {
        proposal.push({ name: generateGroupName(groupPrefix, sem, GroupType.EXERCISE, i), type: GroupType.EXERCISE, size: groupSize, parentName: generateGroupName(groupPrefix, sem, GroupType.LECTURE, 0), semester: sem, studyYear })
      }
    } else if (groupType === GroupType.LAB) {
      const exerciseCount = groupCounts[GroupType.EXERCISE] ?? 1
      const labPerExercise = Math.ceil(groupCount / exerciseCount)
      const exerciseGroupSize = Math.ceil(totalStudents / exerciseCount)
      for (let exerciseIdx = 0; exerciseIdx < exerciseCount; exerciseIdx++) {
        for (let labIdx = 0; labIdx < labPerExercise; labIdx++) {
          proposal.push({ name: generateGroupName(groupPrefix, sem, GroupType.LAB, labIdx, exerciseIdx), type: GroupType.LAB, size: Math.ceil(exerciseGroupSize / labPerExercise), parentName: generateGroupName(groupPrefix, sem, GroupType.EXERCISE, exerciseIdx), semester: sem, studyYear })
        }
      }
      groupCounts[GroupType.LAB] = exerciseCount * labPerExercise
    } else {
      for (let i = 0; i < groupCount; i++) {
        proposal.push({ name: generateGroupName(groupPrefix, sem, groupType, i), type: groupType, size: groupSize, parentName: generateGroupName(groupPrefix, sem, GroupType.LECTURE, 0), semester: sem, studyYear })
      }
    }
  }

  return proposal
}

// POST /api/groups/generate — generuj propozycję (nie zapisuje)
export const generate = async (req: Request, res: Response) => {
  try {
    const { fieldOfStudyId, specializationId, semester, semesterType, academicYear, totalStudents, studyMode } = req.body as {
      fieldOfStudyId: string
      specializationId?: string
      semester?: number
      semesterType?: 'WINTER' | 'SUMMER'
      academicYear: string
      totalStudents: number
      studyMode?: string
    }

    if (!fieldOfStudyId || !academicYear || !totalStudents) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }
    if (totalStudents <= 0) {
      return res.status(400).json({ error: 'totalStudents musi być > 0' })
    }

    const fieldOfStudy = await prisma.fieldOfStudy.findUnique({
      where: { id: fieldOfStudyId },
      select: { shortName: true, facultyId: true },
    })
    if (!fieldOfStudy) return res.status(404).json({ error: 'Kierunek studiów nie znaleziony' })

    let groupPrefix = fieldOfStudy.shortName
    if (specializationId) {
      const specialization = await prisma.specialization.findUnique({
        where: { id: specializationId },
        select: { shortName: true },
      })
      if (specialization) groupPrefix = specialization.shortName
    }
    if (studyMode === 'PART_TIME') groupPrefix = `${groupPrefix}-SN`

    // Pobierz aktywne wersje planu
    const curriculumVersions = await prisma.curriculumVersion.findMany({
      where: {
        isActive: true,
        ...(specializationId
          ? { specializationId }
          : { specialization: { fieldOfStudyId } }),
        ...(studyMode ? { studyMode: studyMode as 'FULL_TIME' | 'PART_TIME' } : {}),
      },
      include: {
        entries: {
          where: semester
            ? { semester }
            : semesterType
              ? { semester: { in: semesterType === 'WINTER' ? [1, 3, 5, 7] : [2, 4, 6] } }
              : undefined,
          select: { semester: true, hoursLecture: true, hoursExercise: true, hoursLab: true, hoursProject: true, hoursSeminar: true },
        },
      },
    })

    // Zbierz klasy typów per semestr
    const semesterClassTypes = new Map<number, Set<GroupType>>()
    for (const version of curriculumVersions) {
      for (const entry of version.entries) {
        if (!semesterClassTypes.has(entry.semester)) semesterClassTypes.set(entry.semester, new Set())
        const types = semesterClassTypes.get(entry.semester)!
        if (entry.hoursLecture > 0)  types.add(GroupType.LECTURE)
        if (entry.hoursExercise > 0) types.add(GroupType.EXERCISE)
        if (entry.hoursLab > 0)      types.add(GroupType.LAB)
        if (entry.hoursProject > 0)  types.add(GroupType.PROJECT)
        if (entry.hoursSeminar > 0)  types.add(GroupType.SEMINAR)
      }
    }

    if (semesterClassTypes.size === 0) {
      return res.status(400).json({ error: 'Brak wpisów w siatce godzin' })
    }

    const proposal: ProposalEntry[] = []
    for (const [sem, classTypes] of [...semesterClassTypes.entries()].sort(([a], [b]) => a - b)) {
      const semProposal = await generateForSemester(sem, groupPrefix, totalStudents, fieldOfStudy.facultyId, classTypes)
      proposal.push(...semProposal)
    }

    res.json({ data: { proposal, meta: { totalStudents, academicYear } } })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// POST /api/groups/confirm — zatwierdź i zapisz propozycję
export const confirm = async (req: Request, res: Response) => {
  try {
    const { fieldOfStudyId, specializationId, academicYear, studyMode, proposal } = req.body as {
      fieldOfStudyId: string
      specializationId?: string
      academicYear: string
      studyMode?: string
      proposal: Array<{
        name: string
        type: GroupType
        size: number
        parentName: string | null
        semester: number
        studyYear: number
        preferredRoomId?: string
      }>
    }

    if (!fieldOfStudyId || !academicYear || !proposal?.length) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    // Sortuj per semestr, grupy bez rodzica pierwsze
    const sorted = [...proposal].sort((a, b) => {
      if (a.semester !== b.semester) return a.semester - b.semester
      if (!a.parentName && b.parentName) return -1
      if (a.parentName && !b.parentName) return 1
      return 0
    })

    const created = await prisma.$transaction(async (tx) => {
      const nameToId = new Map<string, string>()
      const results = []

      for (const group of sorted) {
        const parentId = group.parentName ? nameToId.get(group.parentName) : undefined

        const saved = await tx.studentGroup.create({
          data: {
            name: group.name,
            type: group.type,
            size: group.size,
            fieldOfStudyId,
            specializationId: specializationId ?? null,
            studyYear: group.studyYear,
            semester: group.semester,
            academicYear,
            parentGroupId: parentId ?? null,
            preferredRoomId: null,
          },
        })

        nameToId.set(group.name, saved.id)
        results.push(saved)
      }

      return results
    })

    res.status(201).json({ data: created, message: `Zapisano ${created.length} grup` })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Grupa o tej nazwie już istnieje w tym semestrze i roku akademickim' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// POST /api/groups — utwórz grupę ręcznie
export const createOne = async (req: Request, res: Response) => {
  try {
    const { name, type, size, fieldOfStudyId, specializationId, studyYear, semester, academicYear, parentGroupId, preferredRoomId } = req.body as {
      name: string
      type: GroupType
      size: number
      fieldOfStudyId: string
      specializationId?: string
      studyYear: number
      semester: number
      academicYear: string
      parentGroupId?: string
      preferredRoomId?: string
    }

    if (!name || !type || !size || !fieldOfStudyId || !studyYear || !semester || !academicYear) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    const data = await prisma.studentGroup.create({
      data: {
        name,
        type,
        size,
        fieldOfStudyId,
        specializationId: specializationId ?? null,
        studyYear,
        semester,
        academicYear,
        parentGroupId: parentGroupId ?? null,
        preferredRoomId: preferredRoomId ?? null,
      },
    })
    res.status(201).json({ data, message: 'Grupa utworzona' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Grupa o tej nazwie już istnieje w tym semestrze i roku akademickim' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// PUT /api/groups/:id
export const update = async (req: Request, res: Response) => {
  try {
    const { name, size, preferredRoomId } = req.body as {
      name?: string
      size?: number
      preferredRoomId?: string | null
    }

    const data = await prisma.studentGroup.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(preferredRoomId !== undefined ? { preferredRoomId } : {}),
      },
    })
    res.json({ data, message: 'Grupa zaktualizowana' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Grupa nie znaleziona' })
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Grupa o tej nazwie już istnieje w tym semestrze i roku akademickim' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// DELETE /api/groups/:id
export const remove = async (req: Request, res: Response) => {
  try {
    const group = await prisma.studentGroup.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { scheduleEntries: true } } },
    })
    if (!group) return res.status(404).json({ error: 'Grupa nie znaleziona' })

    if (group._count.scheduleEntries > 0) {
      return res.status(409).json({ error: 'Nie można usunąć grupy przypisanej do planu zajęć' })
    }

    await prisma.studentGroup.delete({ where: { id: req.params.id } })
    res.json({ message: 'Grupa usunięta' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Grupa nie znaleziona' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// DELETE /api/groups — usuń wszystkie grupy (opcjonalnie filtrowane)
export const removeAll = async (req: Request, res: Response) => {
  try {
    const { academicYear } = req.query
    const result = await prisma.studentGroup.deleteMany({
      where: {
        ...(academicYear ? { academicYear: String(academicYear) } : {}),
        scheduleEntries: { none: {} },
      },
    })
    res.json({ message: `Usunięto ${result.count} grup` })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}
