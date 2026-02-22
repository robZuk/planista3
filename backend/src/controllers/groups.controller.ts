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
    const { fieldOfStudyId, semester, academicYear } = req.query
    const data = await prisma.studentGroup.findMany({
      where: {
        ...(fieldOfStudyId ? { fieldOfStudyId: String(fieldOfStudyId) } : {}),
        ...(semester ? { semester: Number(semester) } : {}),
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
    res.status(500).json({ error: 'Błąd serwera', details: error })
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
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

// POST /api/groups/generate — generuj propozycję (nie zapisuje)
export const generate = async (req: Request, res: Response) => {
  try {
    const { fieldOfStudyId, specializationId, studyYear, semester, academicYear, totalStudents } = req.body as {
      fieldOfStudyId: string
      specializationId?: string
      studyYear: number
      semester: number
      academicYear: string
      totalStudents: number
    }

    if (!fieldOfStudyId || !studyYear || !semester || !academicYear || !totalStudents) {
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

    // Pobierz aktywne wersje planu i sprawdź jakie typy zajęć mają godziny w tym semestrze
    const curriculumVersions = await prisma.curriculumVersion.findMany({
      where: {
        isActive: true,
        ...(specializationId
          ? { specializationId }
          : { specialization: { fieldOfStudyId } }),
      },
      include: {
        entries: {
          where: { semester },
          select: {
            hoursLecture: true,
            hoursExercise: true,
            hoursLab: true,
            hoursProject: true,
            hoursSeminar: true,
          },
        },
      },
    })

    const classTypesInSemester = new Set<GroupType>()
    for (const version of curriculumVersions) {
      for (const entry of version.entries) {
        if (entry.hoursLecture > 0)  classTypesInSemester.add(GroupType.LECTURE)
        if (entry.hoursExercise > 0) classTypesInSemester.add(GroupType.EXERCISE)
        if (entry.hoursLab > 0)      classTypesInSemester.add(GroupType.LAB)
        if (entry.hoursProject > 0)  classTypesInSemester.add(GroupType.PROJECT)
        if (entry.hoursSeminar > 0)  classTypesInSemester.add(GroupType.SEMINAR)
      }
    }

    if (classTypesInSemester.size === 0) {
      return res.status(400).json({ error: 'Brak wpisów w siatce godzin dla tego semestru' })
    }

    type ProposalEntry = {
      name: string
      type: GroupType
      size: number
      parentName: string | null
    }

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
      if (!classTypesInSemester.has(groupType)) continue

      // Znajdź największą salę pierwotnego typu (do obliczenia liczby grup)
      // Używamy primaryRoomTypeMap — bez sal zastępczych (np. LECTURE nie liczy dla EXERCISE)
      const largestRoom = await prisma.room.findFirst({
        where: {
          type: { in: primaryRoomTypeMap[groupType] },
          OR: [
            { building: { facultyId: fieldOfStudy.facultyId } },
            { building: { facultyId: null } },
          ],
        },
        orderBy: { capacity: 'desc' },
      })

      const roomCapacity = largestRoom?.capacity ?? totalStudents
      const groupCount = Math.ceil(totalStudents / roomCapacity)
      const groupSize = Math.ceil(totalStudents / groupCount)

      groupCounts[groupType] = groupCount

      if (groupType === GroupType.LECTURE) {
        proposal.push({
          name: generateGroupName(fieldOfStudy.shortName, studyYear, GroupType.LECTURE, 0),
          type: GroupType.LECTURE,
          size: totalStudents,
          parentName: null,
        })
      } else if (groupType === GroupType.EXERCISE) {
        for (let i = 0; i < groupCount; i++) {
          proposal.push({
            name: generateGroupName(fieldOfStudy.shortName, studyYear, GroupType.EXERCISE, i),
            type: GroupType.EXERCISE,
            size: groupSize,
            parentName: generateGroupName(fieldOfStudy.shortName, studyYear, GroupType.LECTURE, 0),
          })
        }
      } else if (groupType === GroupType.LAB) {
        const exerciseCount = groupCounts[GroupType.EXERCISE] ?? 1
        const labPerExercise = Math.ceil(groupCount / exerciseCount)
        const exerciseGroupSize = Math.ceil(totalStudents / exerciseCount)

        for (let exerciseIdx = 0; exerciseIdx < exerciseCount; exerciseIdx++) {
          for (let labIdx = 0; labIdx < labPerExercise; labIdx++) {
            const labSize = Math.ceil(exerciseGroupSize / labPerExercise)
            proposal.push({
              name: generateGroupName(fieldOfStudy.shortName, studyYear, GroupType.LAB, labIdx, exerciseIdx),
              type: GroupType.LAB,
              size: labSize,
              parentName: generateGroupName(fieldOfStudy.shortName, studyYear, GroupType.EXERCISE, exerciseIdx),
            })
          }
        }
        groupCounts[GroupType.LAB] = exerciseCount * labPerExercise
      } else {
        // PROJECT i SEMINAR — dzieci grupy wykładowej
        for (let i = 0; i < groupCount; i++) {
          proposal.push({
            name: generateGroupName(fieldOfStudy.shortName, studyYear, groupType, i),
            type: groupType,
            size: groupSize,
            parentName: generateGroupName(fieldOfStudy.shortName, studyYear, GroupType.LECTURE, 0),
          })
        }
      }
    }

    res.json({
      data: {
        proposal,
        meta: { totalStudents, semester, academicYear, groupCounts },
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

// POST /api/groups/confirm — zatwierdź i zapisz propozycję
export const confirm = async (req: Request, res: Response) => {
  try {
    const { fieldOfStudyId, specializationId, studyYear, semester, academicYear, proposal } = req.body as {
      fieldOfStudyId: string
      specializationId?: string
      studyYear: number
      semester: number
      academicYear: string
      proposal: Array<{
        name: string
        type: GroupType
        size: number
        parentName: string | null
        preferredRoomId?: string
      }>
    }

    if (!fieldOfStudyId || !studyYear || !semester || !academicYear || !proposal?.length) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    // Sortuj: grupy bez rodzica pierwsze
    const sorted = [...proposal].sort((a, b) => {
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
            studyYear,
            semester,
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
    res.status(500).json({ error: 'Błąd serwera', details: error })
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
    res.status(500).json({ error: 'Błąd serwera', details: error })
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
    res.status(500).json({ error: 'Błąd serwera', details: error })
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
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
