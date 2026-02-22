import { PrismaClient, StudyMode, DegreeLevel, AssessmentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
        academicYear: '2024/2025',
        studyMode: StudyMode.FULL_TIME,
      },
    },
    update: {},
    create: {
      academicYear: '2024/2025',
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
        academicYear: '2024/2025',
        studyMode: StudyMode.FULL_TIME,
      },
    },
    update: {},
    create: {
      academicYear: '2024/2025',
      studyMode: StudyMode.FULL_TIME,
      degreeLevel: DegreeLevel.BACHELOR,
      totalSemesters: 7,
      isActive: true,
      specializationId: specZEEW.id,
    },
  });
  console.log('CurriculumVersions created: DUT 2024/2025, ZEEW 2024/2025');

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

  // ─── Budynki ─────────────────────────────────────────────
  const buildingA = await prisma.building.upsert({
    where: { name: 'Budynek A' },
    update: {},
    create: { name: 'Budynek A', address: 'ul. Morska 81-87, Gdynia', facultyId: faculty.id },
  });

  const buildingB = await prisma.building.upsert({
    where: { name: 'Budynek B' },
    update: {},
    create: { name: 'Budynek B', address: 'ul. Morska 81-87, Gdynia', facultyId: faculty.id },
  });

  const centrumSportu = await prisma.building.upsert({
    where: { name: 'Centrum Sportu' },
    update: {},
    create: { name: 'Centrum Sportu', address: 'ul. Morska 81-87, Gdynia', facultyId: null },
  });

  console.log('Buildings created: Budynek A, Budynek B, Centrum Sportu');

  // ─── Sale ────────────────────────────────────────────────
  const saleA = [
    { number: 'A101', type: 'LECTURE',  capacity: 120 },
    { number: 'A102', type: 'LECTURE',  capacity: 80  },
    { number: 'A103', type: 'LECTURE',  capacity: 60  },
    { number: 'A201', type: 'EXERCISE', capacity: 30  },
    { number: 'A202', type: 'EXERCISE', capacity: 30  },
    { number: 'A203', type: 'EXERCISE', capacity: 30  },
    { number: 'A204', type: 'EXERCISE', capacity: 30  },
    { number: 'A301', type: 'SEMINAR',  capacity: 20  },
    { number: 'A302', type: 'SEMINAR',  capacity: 20  },
  ] as const;

  for (const sala of saleA) {
    await prisma.room.upsert({
      where: { number_buildingId: { number: sala.number, buildingId: buildingA.id } },
      update: {},
      create: { ...sala, buildingId: buildingA.id },
    });
  }

  const saleB = [
    { number: 'B101', type: 'LAB',          capacity: 15 },
    { number: 'B102', type: 'LAB',          capacity: 15 },
    { number: 'B103', type: 'LAB',          capacity: 15 },
    { number: 'B104', type: 'LAB',          capacity: 15 },
    { number: 'B201', type: 'COMPUTER_LAB', capacity: 25 },
    { number: 'B202', type: 'COMPUTER_LAB', capacity: 25 },
    { number: 'B301', type: 'EXERCISE',     capacity: 30 },
    { number: 'B302', type: 'EXERCISE',     capacity: 30 },
  ] as const;

  for (const sala of saleB) {
    await prisma.room.upsert({
      where: { number_buildingId: { number: sala.number, buildingId: buildingB.id } },
      update: {},
      create: { ...sala, buildingId: buildingB.id },
    });
  }

  const saleSport = [
    { number: 'Hala Główna',       type: 'SPORTS', capacity: 100 },
    { number: 'Siłownia',          type: 'SPORTS', capacity: 30  },
    { number: 'Sala Gimnastyczna', type: 'SPORTS', capacity: 40  },
  ] as const;

  for (const sala of saleSport) {
    await prisma.room.upsert({
      where: { number_buildingId: { number: sala.number, buildingId: centrumSportu.id } },
      update: {},
      create: { ...sala, buildingId: centrumSportu.id },
    });
  }

  console.log('Rooms created: 9 (A) + 8 (B) + 3 (Sport) = 20');

  // ─── Prowadzący ──────────────────────────────────────────
  const prowadzacyWM = [
    { firstName: 'Jan',       lastName: 'Kowalski',    title: 'prof. dr hab.', email: 'j.kowalski@umg.edu.pl'    },
    { firstName: 'Anna',      lastName: 'Nowak',       title: 'dr hab.',       email: 'a.nowak@umg.edu.pl'        },
    { firstName: 'Piotr',     lastName: 'Wiśniewski',  title: 'dr',            email: 'p.wisniewski@umg.edu.pl'   },
    { firstName: 'Marta',     lastName: 'Wójcik',      title: 'dr',            email: 'm.wojcik@umg.edu.pl'       },
    { firstName: 'Tomasz',    lastName: 'Kamiński',    title: 'dr inż.',       email: 't.kaminski@umg.edu.pl'     },
    { firstName: 'Katarzyna', lastName: 'Lewandowska', title: 'dr inż.',       email: 'k.lewandowska@umg.edu.pl'  },
    { firstName: 'Marek',     lastName: 'Zieliński',   title: 'mgr inż.',      email: 'm.zielinski@umg.edu.pl'    },
    { firstName: 'Agnieszka', lastName: 'Szymańska',   title: 'mgr inż.',      email: 'a.szymanska@umg.edu.pl'    },
    { firstName: 'Robert',    lastName: 'Woźniak',     title: 'dr',            email: 'r.wozniak@umg.edu.pl'      },
    { firstName: 'Monika',    lastName: 'Dąbrowska',   title: 'dr inż.',       email: 'm.dabrowska@umg.edu.pl'    },
    { firstName: 'Krzysztof', lastName: 'Kozłowski',   title: 'prof. dr hab.', email: 'k.kozlowski@umg.edu.pl'    },
    { firstName: 'Ewa',       lastName: 'Jankowska',   title: 'dr',            email: 'e.jankowska@umg.edu.pl'    },
  ];

  for (const p of prowadzacyWM) {
    await prisma.instructor.upsert({
      where: { email: p.email },
      update: {},
      create: { ...p, facultyId: faculty.id },
    });
  }

  const instruktorzyWF = [
    { firstName: 'Zbigniew', lastName: 'Adamski',   title: 'mgr', email: 'z.adamski@umg.edu.pl'  },
    { firstName: 'Joanna',   lastName: 'Michalska', title: 'mgr', email: 'j.michalska@umg.edu.pl' },
  ];

  for (const p of instruktorzyWF) {
    await prisma.instructor.upsert({
      where: { email: p.email },
      update: {},
      create: { ...p, facultyId: null },
    });
  }

  const lektorzy = [
    { firstName: 'Sarah',  lastName: 'Johnson', title: 'mgr', email: 's.johnson@umg.edu.pl' },
    { firstName: 'Michał', lastName: 'Nowicki', title: 'mgr', email: 'm.nowicki@umg.edu.pl'  },
  ];

  for (const p of lektorzy) {
    await prisma.instructor.upsert({
      where: { email: p.email },
      update: {},
      create: { ...p, facultyId: null },
    });
  }

  console.log('Instructors created: 12 (WM) + 2 (WF) + 2 (lektorzy) = 16');

  // ─── Admin user ──────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Admin1234!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@umg.edu.pl' },
    update: {},
    create: {
      email: 'admin@umg.edu.pl',
      password: hashedPassword,
      name: 'Administrator',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin: admin@umg.edu.pl / Admin1234!');

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
