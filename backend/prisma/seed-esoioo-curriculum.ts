/**
 * Seed: Plan studiów ESOIOO — wszystkie semestry (2024/2025)
 * Kierunek: Mechanika i Budowa Maszyn, WM UMG
 * Specjalność: Eksploatacja Siłowni Okrętowych i Obiektów Oceanotechnicznych
 * Studia niestacjonarne I stopnia, profil praktyczny
 * Źródło: Siatka godzin ps1_esoioo_21-22_sn.pdf (obowiązuje w roku akademickim 2021/2022)
 *
 * Uruchom: npx ts-node prisma/seed-esoioo-curriculum.ts
 */
import { PrismaClient, StudyMode, DegreeLevel, AssessmentType } from '@prisma/client';

const prisma = new PrismaClient();

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

// ─── Plan studiów ESOIOO (studia niestacjonarne, 8 semestrów) ─────────────────
// Dane z PDF: Siatka godzin ps1_esoioo_21-22_sn
// Legenda kolumn PDF: W=wykład C=ćwiczenia L=laboratorium P=projekt S=seminarium

const entries: EntryDef[] = [

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR I  (~231h / 30 ECTS)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 1, order: 1,  subjectName: 'Język angielski I',                          hoursLecture: 18, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 2,  subjectName: 'Podstawy informatyki',                       hoursLecture: 10, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 3,  subjectName: 'Socjologia',                                 hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 4,  subjectName: 'Podstawy ekonomii i zarządzania',            hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 5,  subjectName: 'Ochrona własności intelektualnej',           hoursLecture: 10, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 6,  subjectName: 'Bezpieczeństwo pracy i ergonomia',           hoursLecture: 10, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 7,  subjectName: 'Ceremoniał morski I',                        hoursLecture:  3, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 8,  subjectName: 'Matematyka I',                               hoursLecture: 15, hoursExercise: 30, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 7, assessmentType: AssessmentType.EXAM   },
  { semester: 1, order: 9,  subjectName: 'Fizyka I',                                   hoursLecture: 15, hoursExercise: 30, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 7, assessmentType: AssessmentType.EXAM   },
  { semester: 1, order: 10, subjectName: 'Materiałoznawstwo okrętowe I',               hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 1, order: 11, subjectName: 'Podstawy inżynierii wytwarzania I',          hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR II  (~347h / 32 ECTS)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 2, order: 1,  subjectName: 'Język angielski II',                         hoursLecture: 30, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 2,  subjectName: 'Ceremoniał morski II',                       hoursLecture:  2, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 3,  subjectName: 'Matematyka II',                              hoursLecture: 15, hoursExercise: 30, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 5, assessmentType: AssessmentType.EXAM   },
  { semester: 2, order: 4,  subjectName: 'Fizyka II',                                  hoursLecture: 15, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 2, order: 5,  subjectName: 'Grafika inżynierska I',                      hoursLecture: 15, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 6,  subjectName: 'Materiałoznawstwo okrętowe II',              hoursLecture: 15, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 2, order: 7,  subjectName: 'Podstawy inżynierii wytwarzania II',         hoursLecture: 15, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 2, order: 8,  subjectName: 'Termodynamika techniczna I',                 hoursLecture: 15, hoursExercise: 15, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 2, order: 9,  subjectName: 'Elektrotechnika i elektronika I',            hoursLecture: 30, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 2, order: 10, subjectName: 'Mechanika techniczna I',                     hoursLecture: 15, hoursExercise: 15, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR III  (~360h / 28 ECTS)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 3, order: 1,  subjectName: 'Język angielski III',                        hoursLecture: 30, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 2,  subjectName: 'Grafika inżynierska II',                     hoursLecture:  0, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 3,  subjectName: 'Mechanika techniczna II',                    hoursLecture: 15, hoursExercise: 15, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 4,  subjectName: 'Wytrzymałość materiałów I',                  hoursLecture: 15, hoursExercise: 15, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 5,  subjectName: 'Podstawy inżynierii wytwarzania III',        hoursLecture:  0, hoursExercise:  0, hoursLab: 60, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 6,  subjectName: 'Termodynamika techniczna II',                hoursLecture: 15, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 7,  subjectName: 'Elektrotechnika i elektronika II',           hoursLecture:  0, hoursExercise: 15, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 8,  subjectName: 'Podstawy konstrukcji maszyn I',              hoursLecture: 15, hoursExercise: 15, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 9,  subjectName: 'Automatyka i robotyka I',                    hoursLecture: 30, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 3, order: 10, subjectName: 'Metrologia i systemy pomiarowe',             hoursLecture: 15, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 3, order: 11, subjectName: 'Teoria i budowa okrętu I',                   hoursLecture: 30, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR IV  (~330h / 32 ECTS)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 4, order: 1,  subjectName: 'Język angielski IV',                         hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 2,  subjectName: 'Wytrzymałość materiałów II',                 hoursLecture: 15, hoursExercise: 15, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 3,  subjectName: 'Mechanika płynów',                           hoursLecture: 15, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 4,  subjectName: 'Komputerowe wspomaganie projektowania',      hoursLecture:  0, hoursExercise:  0, hoursLab: 30, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 5,  subjectName: 'Podstawy konstrukcji maszyn II',             hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 6,  subjectName: 'Podstawy konstrukcji maszyn III',            hoursLecture:  0, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 7,  subjectName: 'Projekt z PKM I',                            hoursLecture:  0, hoursExercise:  0, hoursLab:  0, hoursProject: 15, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 8,  subjectName: 'Automatyka i robotyka II',                   hoursLecture:  0, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 9,  subjectName: 'Materiałoznawstwo okrętowe III',             hoursLecture:  0, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 10, subjectName: 'Teoria i budowa okrętu II',                  hoursLecture: 30, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 11, subjectName: 'Ochrona środowiska morskiego',               hoursLecture: 25, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 12, subjectName: 'Technologia remontów I',                     hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 13, subjectName: 'Siłownie okrętowe I',                        hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 4, order: 14, subjectName: 'Okrętowe silniki tłokowe I',                 hoursLecture: 30, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 4, order: 15, subjectName: 'Maszyny i urządzenia okrętowe I',            hoursLecture: 30, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR V  (~393h / 30 ECTS)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 5, order: 1,  subjectName: 'Język angielski V',                          hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 2,  subjectName: 'Projekt z PKM II',                           hoursLecture:  0, hoursExercise:  0, hoursLab:  0, hoursProject: 15, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 3,  subjectName: 'Eksploatacja maszyn I',                      hoursLecture:  8, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 4,  subjectName: 'Technologia remontów II',                    hoursLecture: 15, hoursExercise:  0, hoursLab: 30, hoursProject: 10, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 5,  subjectName: 'Siłownie okrętowe II',                       hoursLecture: 15, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 6,  subjectName: 'Okrętowe silniki tłokowe II',                hoursLecture: 15, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 7,  subjectName: 'Maszyny i urządzenia okrętowe II',           hoursLecture: 30, hoursExercise:  0, hoursLab: 15, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 8,  subjectName: 'Kotły okrętowe I',                           hoursLecture: 34, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 9,  subjectName: 'Chłodnictwo i klimatyzacja I',               hoursLecture: 30, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 10, subjectName: 'Elektrotechnika i elektronika okrętowa I',   hoursLecture: 33, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 11, subjectName: 'Płyny eksploatacyjne',                       hoursLecture: 27, hoursExercise:  3, hoursLab:  0, hoursProject: 30, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 5, order: 12, subjectName: 'Bezpieczna eksploatacja statku I',           hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject: 10, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 13, subjectName: 'Diagnostyka techniczna',                     hoursLecture:  8, hoursExercise:  0, hoursLab:  7, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 14, subjectName: 'Podstawy napędu statku',                     hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 5, order: 15, subjectName: 'Prawo i ubezpieczenia morskie',              hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR VI  (~454h / 30 ECTS)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 6, order: 1,  subjectName: 'Język angielski VI',                         hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 2,  subjectName: 'Eksploatacja maszyn II',                     hoursLecture:  7, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 3,  subjectName: 'Technologia remontów III',                   hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 4,  subjectName: 'Siłownie okrętowe III',                      hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject: 10, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 5,  subjectName: 'Okrętowe silniki tłokowe III',               hoursLecture: 20, hoursExercise:  0, hoursLab: 15, hoursProject: 10, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 6,  subjectName: 'Kotły okrętowe II',                          hoursLecture:  0, hoursExercise:  0, hoursLab: 15, hoursProject: 10, hoursSeminar: 0, ects: 1, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 7,  subjectName: 'Turbiny okrętowe',                           hoursLecture: 15, hoursExercise:  0, hoursLab: 15, hoursProject: 15, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 8,  subjectName: 'Maszyny i urządzenia okrętowe III',          hoursLecture: 15, hoursExercise:  0, hoursLab: 15, hoursProject: 10, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 9,  subjectName: 'Chłodnictwo i klimatyzacja II',              hoursLecture:  0, hoursExercise:  0, hoursLab: 15, hoursProject: 10, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 10, subjectName: 'Elektrotechnika i elektronika okrętowa II',  hoursLecture: 45, hoursExercise:  0, hoursLab: 30, hoursProject: 10, hoursSeminar: 0, ects: 4, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 11, subjectName: 'Automatyka okrętowa',                        hoursLecture: 15, hoursExercise:  4, hoursLab: 11, hoursProject: 10, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.EXAM   },
  { semester: 6, order: 12, subjectName: 'Bezpieczna eksploatacja statku II',          hoursLecture:  5, hoursExercise:  0, hoursLab: 10, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 6, order: 13, subjectName: 'Symulator siłowni okrętowej',               hoursLecture:  0, hoursExercise:  0, hoursLab: 44, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.CREDIT },

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR VII  (~112h / 8 ECTS)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 7, order: 1,  subjectName: 'Język angielski VII',                        hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 2, assessmentType: AssessmentType.EXAM   },
  { semester: 7, order: 2,  subjectName: 'Eksploatacja siłowni (przedmiot do wyboru)', hoursLecture: 15, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 3, assessmentType: AssessmentType.CREDIT },
  { semester: 7, order: 3,  subjectName: 'Seminarium dyplomowe',                      hoursLecture:  0, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 30, ects: 1, assessmentType: AssessmentType.CREDIT },
  // Praktyki morskie (PM) — brak godzin kontaktowych, zaliczane po odbyciu rejsu
  // Praca dyplomowa (D)  — brak godzin kontaktowych, zaliczana w sem. VIII

  // ══════════════════════════════════════════════════════════════════════════════
  // SEMESTR VIII  (praca dyplomowa + praktyki — bez zajęć planowych)
  // ══════════════════════════════════════════════════════════════════════════════
  { semester: 8, order: 1,  subjectName: 'Praca dyplomowa',                            hoursLecture:  0, hoursExercise:  0, hoursLab:  0, hoursProject:  0, hoursSeminar: 0, ects: 15, assessmentType: AssessmentType.EXAM  },
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
): Promise<void> {
  let count = 0;
  for (const entry of entries) {
    const subjectId = subjectIds.get(entry.subjectName);
    if (!subjectId) { console.warn(`Brak subject: ${entry.subjectName}`); continue; }
    await prisma.curriculumEntry.upsert({
      where: { curriculumVersionId_subjectId_semester: { curriculumVersionId: cvId, subjectId, semester: entry.semester } },
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
  console.log(`Zapisano ${count} wpisów.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Seed: Plan studiów ESOIOO 2024/2025 ===');

  // Wydział WM musi istnieć (uruchom seed.ts)
  const faculty = await prisma.faculty.findUnique({ where: { shortName: 'WM' } });
  if (!faculty) throw new Error('Brak wydziału WM — uruchom najpierw seed.ts');

  // ─── Kierunek: Mechanika i Budowa Maszyn ─────────────────────────────────
  const fieldOfStudy = await prisma.fieldOfStudy.upsert({
    where: { name_facultyId: { name: 'Mechanika i Budowa Maszyn', facultyId: faculty.id } },
    update: {},
    create: {
      name:      'Mechanika i Budowa Maszyn',
      shortName: 'MiBM',
      facultyId: faculty.id,
    },
  });
  console.log('FieldOfStudy:', fieldOfStudy.shortName);

  // ─── Specjalność: ESOIOO ─────────────────────────────────────────────────
  const spec = await prisma.specialization.upsert({
    where: { name_fieldOfStudyId: { name: 'Eksploatacja Siłowni Okrętowych i Obiektów Oceanotechnicznych', fieldOfStudyId: fieldOfStudy.id } },
    update: {},
    create: {
      name:            'Eksploatacja Siłowni Okrętowych i Obiektów Oceanotechnicznych',
      shortName:       'ESOIOO',
      fieldOfStudyId:  fieldOfStudy.id,
    },
  });
  console.log('Specialization:', spec.shortName);

  // ─── Wersja planu: 2024/2025, niestacjonarne, 8 semestrów ────────────────
  const cv = await prisma.curriculumVersion.upsert({
    where: {
      specializationId_academicYear_studyMode: {
        specializationId: spec.id,
        academicYear:     '2024/2025',
        studyMode:        StudyMode.PART_TIME,
      },
    },
    update: {},
    create: {
      specializationId: spec.id,
      academicYear:     '2024/2025',
      studyMode:        StudyMode.PART_TIME,
      degreeLevel:      DegreeLevel.BACHELOR,
      totalSemesters:   8,
      isActive:         true,
    },
  });
  console.log(`CurriculumVersion ESOIOO 2024/2025 PART_TIME: ${cv.id}`);

  // ─── Przedmioty i wpisy ───────────────────────────────────────────────────
  const subjectIds = await upsertSubjects(entries);
  console.log(`Subjects upserted: ${subjectIds.size}`);

  await upsertEntries(entries, cv.id, subjectIds);

  const total = await prisma.curriculumEntry.count({ where: { curriculumVersionId: cv.id } });
  console.log(`\n✅ Gotowe! ESOIOO 2024/2025: ${total} wpisów w planie`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
