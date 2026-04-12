/**
 * Seed: Plan studiów EDST — wszystkie semestry (2024/2025)
 * Kierunek: Eksploatacja i Diagnostyka Systemów Technicznych, WM UMG
 * Studia stacjonarne I stopnia, uchwała nr 122/XVII z 28.04.2022
 *
 * Uruchom: npx ts-node prisma/seed-edst-curriculum.ts
 */
import { PrismaClient, StudyMode, DegreeLevel, AssessmentType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Typy ────────────────────────────────────────────────────────────────────

type EntryDef = {
  subjectName: string;
  order: number;
  semester: number;
  hoursLecture: number;
  hoursExercise: number;
  hoursLab: number;
  hoursProject: number;
  hoursSeminar: number;
  ects: number;
  assessmentType: AssessmentType;
};

// ─── Przedmioty wspólne ZEEW i DUT (lp 1–45) ─────────────────────────────────
// Sem I–IV: w pełni wspólne. Sem V–VII: wspólne tylko języki i seminarium dyplomowe.

const sharedEntries: EntryDef[] = [
  // ═══ SEMESTR I ═══════════════════════════════════════════════════════════
  { semester: 1, order: 1,  subjectName: 'Język angielski I',                    hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 2,  subjectName: 'Wychowanie fizyczne I',                hoursLecture: 0,  hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 0, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 3,  subjectName: 'Ceremoniał morski I',                  hoursLecture: 10, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 4,  subjectName: 'Ochrona własności intelektualnej',     hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 5,  subjectName: 'Historia techniki',                    hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 6,  subjectName: 'Transport w gospodarce globalnej',     hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 7,  subjectName: 'Techniki kreatywnego myślenia',        hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 8,  subjectName: 'BHP / Podstawy ergonomii',             hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 9,  subjectName: 'Nauki o organizacji I',                hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 10, subjectName: 'Etyka w biznesie / Ekonomia',          hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 11, subjectName: 'Matematyka I',                         hoursLecture: 30, hoursExercise: 45, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 6, assessmentType: AssessmentType.EXAM   },
  { semester: 1, order: 12, subjectName: 'Fizyka I',                             hoursLecture: 30, hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 1, order: 13, subjectName: 'Podstawy informatyki',                 hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 14, subjectName: 'Inżynieria materiałowa I',             hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.EXAM   },

  // ═══ SEMESTR II ══════════════════════════════════════════════════════════
  { semester: 2, order: 1,  subjectName: 'Język angielski II',                   hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 2,  subjectName: 'Wychowanie fizyczne II',               hoursLecture: 0,  hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 0, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 3,  subjectName: 'Ceremoniał morski II',                 hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 5,  ects: 0, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 4,  subjectName: 'Nauki o organizacji II',               hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 5,  subjectName: 'Podstawy zarządzania projektami',      hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 30, hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 6,  subjectName: 'Odnawialne źródła energii',            hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 7,  subjectName: 'Rynek OZE / Prawne aspekty MEW',       hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 8,  subjectName: 'Ochrona środowiska / Ekologiczne aspekty MEW', hoursLecture: 15, hoursExercise: 0, hoursLab: 0, hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 9,  subjectName: 'Fizyka morza / Hydrologia',            hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 10, subjectName: 'Metodologia badań naukowych',          hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 11, subjectName: 'Matematyka II',                        hoursLecture: 30, hoursExercise: 45, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
  { semester: 2, order: 12, subjectName: 'Fizyka II',                            hoursLecture: 30, hoursExercise: 15, hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
  { semester: 2, order: 13, subjectName: 'Inżynieria materiałowa II',            hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 14, subjectName: 'Rysunek techniczny',                   hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },

  // ═══ SEMESTR III ═════════════════════════════════════════════════════════
  { semester: 3, order: 1,  subjectName: 'Język angielski III',                  hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 2,  subjectName: 'Wychowanie fizyczne III',              hoursLecture: 0,  hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 0, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 3,  subjectName: 'Komputerowe wspomaganie projektowania', hoursLecture: 0, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 4,  subjectName: 'Podstawy konstrukcji maszyn',          hoursLecture: 30, hoursExercise: 15, hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 5,  subjectName: 'Wytrzymałość materiałów',              hoursLecture: 30, hoursExercise: 15, hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 6,  subjectName: 'Termodynamika techniczna',             hoursLecture: 30, hoursExercise: 30, hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 6, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 7,  subjectName: 'Mechanika płynów',                     hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 8,  subjectName: 'Technologie informacyjne',             hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 9,  subjectName: 'Podstawy programowania I',             hoursLecture: 30, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 10, subjectName: 'Podstawy baz danych',                  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 11, subjectName: 'Podstawy elektrotechniki',             hoursLecture: 15, hoursExercise: 15, hoursLab: 10, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 12, subjectName: 'Podstawy elektroniki',                 hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 13, subjectName: 'Technologia maszyn I',                 hoursLecture: 30, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR IV ══════════════════════════════════════════════════════════
  { semester: 4, order: 1,  subjectName: 'Język angielski IV',                   hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 2,  subjectName: 'Wychowanie fizyczne IV',               hoursLecture: 0,  hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 0, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 3,  subjectName: 'Podstawy automatyki',                  hoursLecture: 30, hoursExercise: 15, hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 4,  subjectName: 'Maszynoznawstwo',                      hoursLecture: 30, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 5,  subjectName: 'Miernictwo',                           hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 6,  subjectName: 'Technologia maszyn II',                hoursLecture: 30, hoursExercise: 0,  hoursLab: 60, hoursProject: 0,  hoursSeminar: 0,  ects: 6, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 7,  subjectName: 'Podstawy diagnostyki maszyn',          hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 8,  subjectName: 'Metody nieniszczące w diagnostyce',    hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 9,  subjectName: 'Eksploatacja maszyn',                  hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 10, subjectName: 'Zarządzanie utrzymaniem ruchu',        hoursLecture: 30, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 11, subjectName: 'Podstawy tribologii',                  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 12, subjectName: 'Techniki przeciwkorozyjne',            hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 13, subjectName: 'Niezawodność systemów technicznych',   hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR V (wspólne: lp 43 + lp 45) ════════════════════════════════
  { semester: 5, order: 1,  subjectName: 'Język angielski V',                    hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 2,  subjectName: 'Zarządzanie bezpieczeństwem obiektów energetycznych', hoursLecture: 15, hoursExercise: 0, hoursLab: 15, hoursProject: 0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM },

  // ═══ SEMESTR VI (wspólne: lp 44 + lp 45) ═══════════════════════════════
  { semester: 6, order: 1,  subjectName: 'Język angielski VI',                   hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 2,  subjectName: 'Seminarium dyplomowe I',               hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 15, ects: 1, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR VII (wspólne: lp 44 + lp 45) ══════════════════════════════
  { semester: 7, order: 1,  subjectName: 'Język angielski VII',                  hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 7, order: 2,  subjectName: 'Seminarium dyplomowe II',              hoursLecture: 0,  hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 15, ects: 1, assessmentType: AssessmentType.CREDIT },
];

// ─── Przedmioty specjalistyczne ZEEW ──────────────────────────────────────────
// Semestr V–VII

const zeewEntries: EntryDef[] = [
  // ═══ SEMESTR V ZEEW ══════════════════════════════════════════════════════
  { semester: 5, order: 3,  subjectName: 'Język angielski biznesowy',            hoursLecture: 0,  hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 4,  subjectName: 'Język angielski techniczny',           hoursLecture: 0,  hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 5,  subjectName: 'Kompetencje interpersonalne',          hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 6,  subjectName: 'Zarządzanie zasobami ludzkimi',        hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 7,  subjectName: 'Podstawy zarządzania jakością',        hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 8,  subjectName: 'Narzędzia wspomagające zarządzanie projektami', hoursLecture: 15, hoursExercise: 0, hoursLab: 0, hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 9,  subjectName: 'Finansowanie projektów',               hoursLecture: 15, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 10, subjectName: 'Ekonomika przedsiębiorstw / Rachunkowość', hoursLecture: 15, hoursExercise: 0, hoursLab: 15, hoursProject: 0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 11, subjectName: 'Relacje na rynku przemysłowym',        hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 12, subjectName: 'Negocjacje w biznesie',                hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 13, subjectName: 'Nowoczesne metody organizacji pracy',  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 14, subjectName: 'Mechanika stosowana',                  hoursLecture: 30, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 15, subjectName: 'Nowoczesne materiały kompozytowe',     hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 16, subjectName: 'Logistyka i spedycja portowo-morska',  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR VI ZEEW ═════════════════════════════════════════════════════
  { semester: 6, order: 3,  subjectName: 'Zarządzanie łańcuchami dostaw',        hoursLecture: 30, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 4,  subjectName: 'Systemy transportowe w projektach MEW', hoursLecture: 15, hoursExercise: 0, hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 5,  subjectName: 'Przewóz ładunków nienormatywnych',     hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 6,  subjectName: 'Prawo morskie / Prawo energetyczne',   hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 7,  subjectName: 'Cła, taryfy i podatki w transporcie morskim', hoursLecture: 15, hoursExercise: 0, hoursLab: 0, hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 8,  subjectName: 'Ubezpieczenia morskie',                hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 9,  subjectName: 'Wytwarzanie i przesył energii elektrycznej', hoursLecture: 15, hoursExercise: 0, hoursLab: 0, hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 10, subjectName: 'Podstawy budowy elektrowni wiatrowych', hoursLecture: 15, hoursExercise: 0, hoursLab: 0, hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 11, subjectName: 'Podstawy eksploatacji elektrowni wiatrowych', hoursLecture: 15, hoursExercise: 0, hoursLab: 0, hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.EXAM },
  { semester: 6, order: 12, subjectName: 'Maszyny i urządzenia elektryczne',     hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR VII ZEEW ════════════════════════════════════════════════════
  { semester: 7, order: 3,  subjectName: 'Dokumentacja technologiczna',          hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 7, order: 4,  subjectName: 'Urządzenia przeładunkowe',             hoursLecture: 0,  hoursExercise: 30, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 7, order: 5,  subjectName: 'Komputerowe wspomaganie decyzji',      hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 7, order: 6,  subjectName: 'Podstawy optymalizacji',               hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 7, order: 7,  subjectName: 'Rachunek kosztów w działalności remontowej', hoursLecture: 15, hoursExercise: 0, hoursLab: 15, hoursProject: 0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM },
  { semester: 7, order: 8,  subjectName: 'Predykcyjne utrzymanie ruchu',         hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 7, order: 9,  subjectName: 'Analiza niezawodnościowa systemów technicznych', hoursLecture: 15, hoursExercise: 0, hoursLab: 15, hoursProject: 0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
];

// ─── Przedmioty specjalistyczne DUT ───────────────────────────────────────────
// Semestr II–VI

const dutEntries: EntryDef[] = [
  // ═══ SEMESTR II DUT ══════════════════════════════════════════════════════
  { semester: 2, order: 15, subjectName: 'Podstawy funkcjonowania przedsiębiorstw / Modele biznesowe', hoursLecture: 15, hoursExercise: 0, hoursLab: 0, hoursProject: 0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR III DUT ═════════════════════════════════════════════════════
  { semester: 3, order: 14, subjectName: 'Matematyka III',                       hoursLecture: 30, hoursExercise: 45, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 5, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 15, subjectName: 'Mechanika techniczna I',               hoursLecture: 30, hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR IV DUT ══════════════════════════════════════════════════════
  { semester: 4, order: 14, subjectName: 'Mechanika techniczna II',              hoursLecture: 30, hoursExercise: 15, hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 15, subjectName: 'Drgania mechaniczne',                  hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 16, subjectName: 'Mechatronika',                         hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 17, subjectName: 'Silniki spalinowe',                    hoursLecture: 30, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 18, subjectName: 'Siłownie okrętowe',                   hoursLecture: 30, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 19, subjectName: 'Kotły',                                hoursLecture: 30, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 20, subjectName: 'Turbiny',                              hoursLecture: 30, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR V DUT ═══════════════════════════════════════════════════════
  { semester: 5, order: 3,  subjectName: 'Siłownie wiatrowe',                   hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 4,  subjectName: 'Diagnostyka silników spalinowych',     hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 5,  subjectName: 'Diagnostyka płynów eksploatacyjnych',  hoursLecture: 30, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 6,  subjectName: 'Diagnostyka maszyn i urządzeń',        hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 7,  subjectName: 'Zaawansowane systemy diagnostyczne',   hoursLecture: 15, hoursExercise: 0,  hoursLab: 0,  hoursProject: 0,  hoursSeminar: 0,  ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 8,  subjectName: 'Podstawy programowania II',            hoursLecture: 0,  hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },

  // ═══ SEMESTR VI DUT ══════════════════════════════════════════════════════
  { semester: 6, order: 3,  subjectName: 'Numeryczne modelowanie i symulacja',   hoursLecture: 30, hoursExercise: 0,  hoursLab: 30, hoursProject: 0,  hoursSeminar: 0,  ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 4,  subjectName: 'Technologie transmisji danych',        hoursLecture: 15, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 5,  subjectName: 'Przetwarzanie sygnałów',               hoursLecture: 30, hoursExercise: 0,  hoursLab: 15, hoursProject: 0,  hoursSeminar: 0,  ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 6,  subjectName: 'Podstawy uczenia maszynowego i analiza danych', hoursLecture: 15, hoursExercise: 0, hoursLab: 15, hoursProject: 0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertSubjects(entries: EntryDef[]): Promise<Map<string, string>> {
  const subjectIds = new Map<string, string>();
  const uniqueNames = [...new Set(entries.map(e => e.subjectName))];
  for (const name of uniqueNames) {
    const subject = await prisma.subject.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    subjectIds.set(name, subject.id);
  }
  return subjectIds;
}

async function upsertEntries(
  entries: EntryDef[],
  cvId: string,
  subjectIds: Map<string, string>,
  label: string,
): Promise<void> {
  let count = 0;
  for (const entry of entries) {
    const subjectId = subjectIds.get(entry.subjectName);
    if (!subjectId) {
      console.warn(`[${label}] Brak subject: ${entry.subjectName}`);
      continue;
    }
    await prisma.curriculumEntry.upsert({
      where: {
        curriculumVersionId_subjectId_semester: {
          curriculumVersionId: cvId,
          subjectId,
          semester: entry.semester,
        },
      },
      update: {
        orderInSemester: entry.order,
        hoursLecture:    entry.hoursLecture,
        hoursExercise:   entry.hoursExercise,
        hoursLab:        entry.hoursLab,
        hoursProject:    entry.hoursProject,
        hoursSeminar:    entry.hoursSeminar,
        ects:            entry.ects,
        assessmentType:  entry.assessmentType,
      },
      create: {
        curriculumVersionId: cvId,
        subjectId,
        semester:        entry.semester,
        orderInSemester: entry.order,
        hoursLecture:    entry.hoursLecture,
        hoursExercise:   entry.hoursExercise,
        hoursLab:        entry.hoursLab,
        hoursProject:    entry.hoursProject,
        hoursSeminar:    entry.hoursSeminar,
        ects:            entry.ects,
        assessmentType:  entry.assessmentType,
      },
    });
    count++;
  }
  console.log(`[${label}] Zapisano ${count} wpisów.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Seed: Plan studiów EDST 2024/2025 ===');

  // Pobierz istniejące rekordy (muszą być stworzone przez seed.ts)
  const faculty = await prisma.faculty.findUnique({ where: { shortName: 'WM' } });
  if (!faculty) throw new Error('Brak wydziału WM — uruchom najpierw seed.ts');

  const fieldOfStudy = await prisma.fieldOfStudy.findFirst({
    where: { shortName: 'EDST', facultyId: faculty.id },
  });
  if (!fieldOfStudy) throw new Error('Brak kierunku EDST');

  const specZEEW = await prisma.specialization.findFirst({
    where: { shortName: 'ZEEW', fieldOfStudyId: fieldOfStudy.id },
  });
  const specDUT = await prisma.specialization.findFirst({
    where: { shortName: 'DUT', fieldOfStudyId: fieldOfStudy.id },
  });
  if (!specZEEW || !specDUT) throw new Error('Brak specjalności ZEEW lub DUT');

  // ─── Wersje planu dla 2024/2025 ────────────────────────────────────────
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
      specializationId: specZEEW.id,
      academicYear:    '2024/2025',
      studyMode:       StudyMode.FULL_TIME,
      degreeLevel:     DegreeLevel.BACHELOR,
      totalSemesters:  7,
      isActive:        true,
    },
  });

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
      specializationId: specDUT.id,
      academicYear:    '2024/2025',
      studyMode:       StudyMode.FULL_TIME,
      degreeLevel:     DegreeLevel.BACHELOR,
      totalSemesters:  7,
      isActive:        true,
    },
  });

  console.log(`CurriculumVersion ZEEW 2024/2025: ${cvZEEW.id}`);
  console.log(`CurriculumVersion DUT  2024/2025: ${cvDUT.id}`);

  // ─── Upsert wszystkich przedmiotów ─────────────────────────────────────
  const allEntries = [...sharedEntries, ...zeewEntries, ...dutEntries];
  const subjectIds = await upsertSubjects(allEntries);
  console.log(`Subjects upserted: ${subjectIds.size}`);

  // ─── Wpisy do planu ZEEW ───────────────────────────────────────────────
  await upsertEntries([...sharedEntries, ...zeewEntries], cvZEEW.id, subjectIds, 'ZEEW');

  // ─── Wpisy do planu DUT ────────────────────────────────────────────────
  await upsertEntries([...sharedEntries, ...dutEntries], cvDUT.id, subjectIds, 'DUT');

  // ─── Podsumowanie ─────────────────────────────────────────────────────
  const totalZEEW = await prisma.curriculumEntry.count({ where: { curriculumVersionId: cvZEEW.id } });
  const totalDUT  = await prisma.curriculumEntry.count({ where: { curriculumVersionId: cvDUT.id  } });
  console.log(`\n✅ Gotowe!`);
  console.log(`   ZEEW 2024/2025: ${totalZEEW} wpisów w planie`);
  console.log(`   DUT  2024/2025: ${totalDUT}  wpisów w planie`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
