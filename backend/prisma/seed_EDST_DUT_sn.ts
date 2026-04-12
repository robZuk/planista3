import { PrismaClient, StudyMode, DegreeLevel, AssessmentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database (EDST DUT – studia niestacjonarne)...');

  // ─── Faculty ─────────────────────────────────────────────
  const faculty = await prisma.faculty.upsert({
    where: { shortName: 'WM' },
    update: {},
    create: {
      name: 'Wydział Mechaniczny',
      shortName: 'WM',
    },
  });
  console.log('Faculty:', faculty.shortName);

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
  console.log('FieldOfStudy:', fieldOfStudy.shortName);

  // ─── Specialization ──────────────────────────────────────
  const specDUT = await prisma.specialization.upsert({
    where: { name_fieldOfStudyId: { name: 'Diagnostyka Urządzeń Technicznych', fieldOfStudyId: fieldOfStudy.id } },
    update: {},
    create: {
      name: 'Diagnostyka Urządzeń Technicznych',
      shortName: 'DUT',
      fieldOfStudyId: fieldOfStudy.id,
    },
  });
  console.log('Specialization: DUT');

  // ─── Curriculum Version ──────────────────────────────────
  const cv = await prisma.curriculumVersion.upsert({
    where: {
      specializationId_academicYear_studyMode: {
        specializationId: specDUT.id,
        academicYear: '2024/2025',
        studyMode: StudyMode.PART_TIME,
      },
    },
    update: {},
    create: {
      academicYear: '2024/2025',
      studyMode: StudyMode.PART_TIME,
      degreeLevel: DegreeLevel.BACHELOR,
      totalSemesters: 7,
      isActive: true,
      specializationId: specDUT.id,
    },
  });
  console.log('CurriculumVersion: DUT 2024/2025 PART_TIME');

  // ─── Subjects + Curriculum Entries ───────────────────────
  // assessmentType: EXAM for subjects with significant lecture+lab load (ECTS >= 4),
  // or where exam is implied by the plan; CREDIT for the rest.
  // Subjects marked with * are elective (wybór) – treated as CREDIT unless ECTS >= 4.

  type EntryInput = {
    semester: number;
    order: number;
    hoursLecture: number;
    hoursExercise: number;
    hoursLab: number;
    hoursProject: number;
    hoursSeminar: number;
    ects: number;
    assessmentType: AssessmentType;
  };

  type SubjectSeed = {
    name: string;
    entries: EntryInput[];
  };

  const subjectSeeds: SubjectSeed[] = [
    // ── Sem 1 & 2 ──
    {
      name: 'Język angielski I, II',
      entries: [
        { semester: 1, order: 1,  hoursLecture: 0,  hoursExercise: 20, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
        { semester: 2, order: 1,  hoursLecture: 0,  hoursExercise: 20, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Ochrona własności intelektualnej',
      entries: [
        { semester: 1, order: 2,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Historia techniki',
      entries: [
        { semester: 1, order: 3,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Transport w gospodarce globalnej',
      entries: [
        { semester: 1, order: 4,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Techniki kreatywnego myślenia',
      entries: [
        { semester: 1, order: 5,  hoursLecture: 0,  hoursExercise: 10, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Bezpieczeństwo i higiena pracy / Podstawy ergonomii',
      entries: [
        { semester: 1, order: 6,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Nauki o organizacji / Podstawy zarządzania',
      entries: [
        { semester: 1, order: 7,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
        { semester: 3, order: 1,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Odnawialne źródła energii',
      entries: [
        { semester: 1, order: 8,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Rynek OZE w Polsce / Prawne aspekty morskiej energetyki wiatrowej',
      entries: [
        { semester: 1, order: 9,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Matematyka I, II',
      entries: [
        { semester: 1, order: 10, hoursLecture: 30, hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 6, assessmentType: AssessmentType.EXAM   },
        { semester: 2, order: 2,  hoursLecture: 15, hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Fizyka I, II',
      entries: [
        { semester: 1, order: 11, hoursLecture: 15, hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
        { semester: 2, order: 3,  hoursLecture: 15, hoursExercise: 15, hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Podstawy informatyki',
      entries: [
        { semester: 1, order: 12, hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Inżynieria materiałowa I, II',
      entries: [
        { semester: 1, order: 13, hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
        { semester: 2, order: 4,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Podstawy elektrotechniki',
      entries: [
        { semester: 1, order: 14, hoursLecture: 10, hoursExercise: 10, hoursLab: 10, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Maszynoznawstwo',
      entries: [
        { semester: 1, order: 15, hoursLecture: 30, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
      ],
    },

    // ── Sem 2 ──
    {
      name: 'Etyka w biznesie / Ekonomia',
      entries: [
        { semester: 2, order: 5,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Rysunek techniczny',
      entries: [
        { semester: 2, order: 6,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Technologie informacyjne',
      entries: [
        { semester: 2, order: 7,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Podstawy elektroniki',
      entries: [
        { semester: 2, order: 8,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 10, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Miernictwo',
      entries: [
        { semester: 2, order: 9,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Mechanika techniczna I, II',
      entries: [
        { semester: 2, order: 10, hoursLecture: 15, hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
        { semester: 3, order: 2,  hoursLecture: 15, hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },

    // ── Sem 3 ──
    {
      name: 'Ochrona środowiska / Ekologiczne aspekty eksploatacji morskich farm wiatrowych',
      entries: [
        { semester: 3, order: 3,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Matematyka III',
      entries: [
        { semester: 3, order: 4,  hoursLecture: 15, hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Wytrzymałość materiałów',
      entries: [
        { semester: 3, order: 5,  hoursLecture: 20, hoursExercise: 15, hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Termodynamika techniczna',
      entries: [
        { semester: 3, order: 6,  hoursLecture: 30, hoursExercise: 15, hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 6, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Mechanika płynów',
      entries: [
        { semester: 3, order: 7,  hoursLecture: 15, hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Podstawy programowania I',
      entries: [
        { semester: 3, order: 8,  hoursLecture: 20, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Technologia maszyn I, II',
      entries: [
        { semester: 3, order: 9,  hoursLecture: 30, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
        { semester: 4, order: 1,  hoursLecture: 30, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 6, assessmentType: AssessmentType.EXAM   },
      ],
    },

    // ── Sem 4 ──
    {
      name: 'Komputerowe wspomaganie projektowania',
      entries: [
        { semester: 4, order: 2,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 20, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Podstawy konstrukcji maszyn',
      entries: [
        { semester: 4, order: 3,  hoursLecture: 20, hoursExercise: 15, hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Podstawy automatyki',
      entries: [
        { semester: 4, order: 4,  hoursLecture: 30, hoursExercise: 15, hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Podstawy diagnostyki maszyn',
      entries: [
        { semester: 4, order: 5,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Techniki przeciwkorozyjne',
      entries: [
        { semester: 4, order: 6,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 10, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Drgania mechaniczne',
      entries: [
        { semester: 4, order: 7,  hoursLecture: 10, hoursExercise: 10, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Silniki spalinowe',
      entries: [
        { semester: 4, order: 8,  hoursLecture: 20, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Podstawy programowania II',
      entries: [
        { semester: 4, order: 9,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Praktyka warsztatowa',
      entries: [
        { semester: 4, order: 10, hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },

    // ── Sem 5 ──
    {
      name: 'Podstawy zarządzania projektami',
      entries: [
        { semester: 5, order: 1,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 15, hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Język angielski III–VII',
      entries: [
        { semester: 3, order: 10, hoursLecture: 0,  hoursExercise: 20, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
        { semester: 4, order: 11, hoursLecture: 0,  hoursExercise: 20, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
        { semester: 5, order: 2,  hoursLecture: 0,  hoursExercise: 20, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
        { semester: 6, order: 1,  hoursLecture: 0,  hoursExercise: 20, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
        { semester: 7, order: 1,  hoursLecture: 0,  hoursExercise: 20, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Podstawy funkcjonowania przedsiębiorstw / Modele biznesowe przedsiębiorstw',
      entries: [
        { semester: 5, order: 3,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Podstawy baz danych',
      entries: [
        { semester: 5, order: 4,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Metody nieniszczące w diagnostyce',
      entries: [
        { semester: 5, order: 5,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 20, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Eksploatacja maszyn',
      entries: [
        { semester: 5, order: 6,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Podstawy tribologii',
      entries: [
        { semester: 5, order: 7,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 10, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Mechatronika',
      entries: [
        { semester: 5, order: 8,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Siłownie okrętowe',
      entries: [
        { semester: 5, order: 9,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Kotły',
      entries: [
        { semester: 5, order: 10, hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Turbiny',
      entries: [
        { semester: 5, order: 11, hoursLecture: 20, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Siłownie wiatrowe',
      entries: [
        { semester: 5, order: 12, hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Diagnostyka silników spalinowych',
      entries: [
        { semester: 5, order: 13, hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Diagnostyka płynów eksploatacyjnych',
      entries: [
        { semester: 5, order: 14, hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },

    // ── Sem 6 ──
    {
      name: 'Zarządzanie utrzymaniem ruchu',
      entries: [
        { semester: 6, order: 2,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 15, hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Niezawodność systemów technicznych',
      entries: [
        { semester: 6, order: 3,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 10, hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Diagnostyka maszyn i urządzeń',
      entries: [
        { semester: 6, order: 4,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Numeryczne modelowanie i symulacja',
      entries: [
        { semester: 6, order: 5,  hoursLecture: 30, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Metodologia badań naukowych',
      entries: [
        { semester: 6, order: 6,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 15, ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Seminarium dyplomowe I, II',
      entries: [
        { semester: 6, order: 7,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 15, ects: 1, assessmentType: AssessmentType.CREDIT },
        { semester: 7, order: 2,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 15, ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Praktyka przemysłowa',
      entries: [
        { semester: 6, order: 8,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 15, assessmentType: AssessmentType.CREDIT },
      ],
    },

    // ── Sem 7 ──
    {
      name: 'Fizyka morza / Hydrologia mórz i oceanów',
      entries: [
        { semester: 7, order: 3,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 10, hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Zarządzanie bezpieczeństwem obiektów energetycznych',
      entries: [
        { semester: 7, order: 4,  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 15, hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Zaawansowane systemy diagnostyczne',
      entries: [
        { semester: 7, order: 5,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 0, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Technologie transmisji danych',
      entries: [
        { semester: 7, order: 6,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Przetwarzanie sygnałów',
      entries: [
        { semester: 7, order: 7,  hoursLecture: 30, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.EXAM   },
      ],
    },
    {
      name: 'Podstawy uczenia maszynowego i analiza danych',
      entries: [
        { semester: 7, order: 8,  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
      ],
    },
    {
      name: 'Praca dyplomowa',
      entries: [
        { semester: 7, order: 9,  hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 15, assessmentType: AssessmentType.CREDIT },
      ],
    },
  ];

  let subjectCount = 0;
  let entryCount = 0;

  for (const subjectSeed of subjectSeeds) {
    const subject = await prisma.subject.upsert({
      where: { name: subjectSeed.name },
      update: {},
      create: { name: subjectSeed.name },
    });
    subjectCount++;

    for (const entry of subjectSeed.entries) {
      await prisma.curriculumEntry.upsert({
        where: {
          curriculumVersionId_subjectId_semester: {
            curriculumVersionId: cv.id,
            subjectId: subject.id,
            semester: entry.semester,
          },
        },
        update: {},
        create: {
          curriculumVersionId: cv.id,
          subjectId: subject.id,
          semester: entry.semester,
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
      entryCount++;
    }
  }

  console.log(`Subjects upserted: ${subjectCount}`);
  console.log(`CurriculumEntries upserted: ${entryCount}`);

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

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
