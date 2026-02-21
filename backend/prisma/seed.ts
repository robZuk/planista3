import { PrismaClient, StudyMode, DegreeLevel, AssessmentType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Faculty ─────────────────────────────────────────────
  const faculty = await prisma.faculty.upsert({
    where: { shortName: 'WM' },
    update: {},
    create: {
      name: 'Wydział Mechaniczny',
      shortName: 'WM',
    },
  });
  console.log('Faculty created:', faculty.shortName);

  // ─── Field of Study ──────────────────────────────────────
  const fieldOfStudy = await prisma.fieldOfStudy.upsert({
    where: { name_facultyId: { name: 'Eksploatacja i Diagnostyka Systemów Technicznych', facultyId: faculty.id } },
    update: {},
    create: {
      name: 'Eksploatacja i Diagnostyka Systemów Technicznych',
      shortName: 'EDST',
      facultyId: faculty.id,
    },
  });
  console.log('FieldOfStudy created:', fieldOfStudy.shortName);

  // ─── Specializations ─────────────────────────────────────
  const specDUT = await prisma.specialization.upsert({
    where: { name_fieldOfStudyId: { name: 'Diagnostyka Urządzeń Technicznych', fieldOfStudyId: fieldOfStudy.id } },
    update: {},
    create: {
      name: 'Diagnostyka Urządzeń Technicznych',
      shortName: 'DUT',
      fieldOfStudyId: fieldOfStudy.id,
    },
  });

  const specZEEW = await prisma.specialization.upsert({
    where: { name_fieldOfStudyId: { name: 'Zarządzanie Eksploatacją Elektrowni Wiatrowych', fieldOfStudyId: fieldOfStudy.id } },
    update: {},
    create: {
      name: 'Zarządzanie Eksploatacją Elektrowni Wiatrowych',
      shortName: 'ZEEW',
      fieldOfStudyId: fieldOfStudy.id,
    },
  });
  console.log('Specializations created: DUT, ZEEW');

  // ─── Subjects ────────────────────────────────────────────
  const subjectsData = [
    { name: 'Język angielski I' },
    { name: 'Wychowanie fizyczne I' },
    { name: 'Ceremoniał morski I' },
    { name: 'Ochrona własności intelektualnej' },
    { name: 'Historia techniki' },
    { name: 'Transport w gospodarce globalnej' },
    { name: 'Techniki kreatywnego myślenia' },
    { name: 'BHP i podstawy ergonomii' },
    { name: 'Nauki o organizacji i podstawy zarządzania' },
    { name: 'Etyka w biznesie i ekonomia' },
    { name: 'Matematyka I' },
    { name: 'Fizyka I' },
    { name: 'Podstawy informatyki' },
    { name: 'Inżynieria materiałowa I' },
    { name: 'Rysunek techniczny' },
  ];

  const subjects: Record<string, { id: string }> = {};
  for (const s of subjectsData) {
    const subject = await prisma.subject.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name },
    });
    subjects[s.name] = subject;
  }
  console.log('Subjects created:', Object.keys(subjects).length);

  // ─── Curriculum Versions ─────────────────────────────────
  const cvDUT = await prisma.curriculumVersion.upsert({
    where: {
      specializationId_academicYear_studyMode: {
        specializationId: specDUT.id,
        academicYear: '2022/2023',
        studyMode: StudyMode.FULL_TIME,
      },
    },
    update: {},
    create: {
      academicYear: '2022/2023',
      studyMode: StudyMode.FULL_TIME,
      degreeLevel: DegreeLevel.BACHELOR,
      totalSemesters: 7,
      isActive: true,
      specializationId: specDUT.id,
    },
  });

  const cvZEEW = await prisma.curriculumVersion.upsert({
    where: {
      specializationId_academicYear_studyMode: {
        specializationId: specZEEW.id,
        academicYear: '2022/2023',
        studyMode: StudyMode.FULL_TIME,
      },
    },
    update: {},
    create: {
      academicYear: '2022/2023',
      studyMode: StudyMode.FULL_TIME,
      degreeLevel: DegreeLevel.BACHELOR,
      totalSemesters: 7,
      isActive: true,
      specializationId: specZEEW.id,
    },
  });
  console.log('CurriculumVersions created: DUT 2022/2023, ZEEW 2022/2023');

  // ─── Curriculum Entries (semestr 1) ──────────────────────
  const entriesData: Array<{
    name: string;
    order: number;
    hoursLecture: number;
    hoursExercise: number;
    hoursLab: number;
    hoursProject: number;
    hoursSeminar: number;
    ects: number;
    assessmentType: AssessmentType;
  }> = [
    { name: 'Język angielski I',                           order: 1,  hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
    { name: 'Wychowanie fizyczne I',                       order: 2,  hoursLecture: 0,  hoursExercise: 15, hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 0, assessmentType: AssessmentType.CREDIT },
    { name: 'Ceremoniał morski I',                         order: 3,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Ochrona własności intelektualnej',            order: 4,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Historia techniki',                           order: 5,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Transport w gospodarce globalnej',            order: 6,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Techniki kreatywnego myślenia',               order: 7,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'BHP i podstawy ergonomii',                    order: 8,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Nauki o organizacji i podstawy zarządzania',  order: 9,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Etyka w biznesie i ekonomia',                 order: 10, hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Matematyka I',                                order: 11, hoursLecture: 30, hoursExercise: 0,  hoursLab: 45, hoursProject: 0, hoursSeminar: 0, ects: 6, assessmentType: AssessmentType.EXAM   },
    { name: 'Fizyka I',                                    order: 12, hoursLecture: 30, hoursExercise: 0,  hoursLab: 30, hoursProject: 0, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
    { name: 'Podstawy informatyki',                        order: 13, hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Inżynieria materiałowa I',                    order: 14, hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
    { name: 'Rysunek techniczny',                          order: 15, hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  ];

  for (const cv of [cvDUT, cvZEEW]) {
    for (const entry of entriesData) {
      const subject = subjects[entry.name];
      if (!subject) {
        console.warn(`Subject not found: ${entry.name}`);
        continue;
      }
      await prisma.curriculumEntry.upsert({
        where: {
          curriculumVersionId_subjectId_semester: {
            curriculumVersionId: cv.id,
            subjectId: subject.id,
            semester: 1,
          },
        },
        update: {},
        create: {
          curriculumVersionId: cv.id,
          subjectId: subject.id,
          semester: 1,
          orderInSemester: entry.order,
          hoursLecture: entry.hoursLecture,
          hoursExercise: entry.hoursExercise,
          hoursLab: entry.hoursLab,
          hoursProject: entry.hoursProject,
          hoursSeminar: entry.hoursSeminar,
          ects: entry.ects,
          assessmentType: entry.assessmentType,
        },
      });
    }
    console.log(`CurriculumEntries seeded for version: ${cv.id}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
