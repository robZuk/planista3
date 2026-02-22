# CLAUDE.md — System Planisty (UMG)

## Tech Stack

| Warstwa     | Technologia                                        |
|-------------|----------------------------------------------------|
| Backend     | Node.js + Express + TypeScript, port 4000          |
| Baza danych | PostgreSQL (Docker), ORM: Prisma                   |
| Auth        | JWT access (24h) + refresh (7d), bcryptjs          |
| Frontend    | React + TypeScript + Vite, port 5173               |
| UI          | shadcn/ui + Tailwind CSS                           |
| State       | TanStack Query (server), Zustand (auth + globalCtx)|

## Stan projektu — wszystko zaimplementowane

- [x] Schemat Prisma + migracje
- [x] Seed — dane testowe (wydziały, kierunki, specjalności, siatki godzin, budynki, sale, prowadzący, admin)
- [x] REST API — pełne CRUD dla wszystkich zasobów
- [x] Auth JWT (`/api/auth`: login, logout, refresh, me, register)
- [x] Middleware `authenticate` + `authorize(role)` na wszystkich chronionych routach
- [x] Frontend — wszystkie strony (Login, Dashboard, Curriculum, Schedule, Groups, Buildings, Instructors, Faculties)
- [x] Globalny kontekst roku/semestru (Zustand, persisted)

## Struktura projektu

```
planista3/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        ← modele: User, Faculty, FieldOfStudy, Specialization,
│   │   │                           CurriculumVersion, CurriculumEntry, Subject,
│   │   │                           Building, Room, Instructor, StudentGroup, ScheduleEntry
│   │   └── seed.ts
│   └── src/
│       ├── index.ts             ← Express entry point
│       ├── lib/prisma.ts        ← singleton PrismaClient
│       ├── middleware/authenticate.ts
│       ├── routes/              ← auth, faculties, fields-of-study, specializations,
│       │                           buildings, instructors, curriculum, subjects,
│       │                           groups, schedule
│       └── controllers/
└── frontend/src/
    ├── api/                     ← auth, curriculum, groups, schedule, buildings,
    │                               instructors, faculties
    ├── components/layout/       ← AppShell, Sidebar, ProtectedRoute
    ├── pages/                   ← LoginPage, DashboardPage, CurriculumPage,
    │                               SchedulePage, GroupsPage, BuildingsPage,
    │                               InstructorsPage, FacultiesPage
    ├── store/
    │   ├── authStore.ts         ← user, accessToken, refreshToken (persisted)
    │   └── academicYearStore.ts ← academicYear, semesterType WINTER|SUMMER (persisted)
    └── types/index.ts
```

## Konwencje

- TypeScript wszędzie, zero `any`
- Prisma tylko przez `src/lib/prisma.ts`
- Każdy controller w `try/catch`
- API response: `{ data: T, message?: string }` / `{ error: string, details?: unknown }`
- Kody błędów: 400 bad request, 401 unauthorized, 403 forbidden, 404 not found, 409 conflict, 422 unprocessable, 500 server error

## Role i uprawnienia

| Zasób | ADMIN | DEAN_OFFICE | INSTRUCTOR | STUDENT |
|---|---|---|---|---|
| GET curriculum/schedule/groups | ✅ | ✅ | ✅ | ✅ |
| POST/PUT/DELETE curriculum | ✅ | ❌ | ❌ | ❌ |
| POST/PUT schedule | ✅ | ❌ | własne | ❌ |
| POST/PUT/DELETE groups | ✅ | ❌ | ❌ | ❌ |
| GET buildings/instructors/faculties | ✅ | ✅ | ✅ | ❌ |
| POST/PUT/DELETE buildings/instructors | ✅ | ❌ | ❌ | ❌ |
| /auth/register | ADMIN only | — | — | — |

## Globalny kontekst roku/semestru

```ts
// academicYearStore.ts
academicYear: string          // np. "2024/2025"
semesterType: 'WINTER'|'SUMMER'
SEMESTER_TYPE_NUMBERS = { WINTER: [1,3,5,7], SUMMER: [2,4,6] }
```

Używany w: SchedulePage, GroupsPage, CurriculumPage. Select w Sidebar (`"2024/2025|WINTER"`).

## Grupy — nazewnictwo

Prefix = `specialization.shortName` jeśli podano spec, inaczej `fieldOfStudy.shortName`.

```
{PREFIX}-{rok}-W          → wykład (jeden)
{PREFIX}-{rok}-C-A/B/...  → ćwiczenia
{PREFIX}-{rok}-L-A1/A2/B1 → laboratoria (dzieci ćwiczeń)
{PREFIX}-{rok}-P-A/B/...  → projekt
{PREFIX}-{rok}-S-A/B/...  → seminarium
```

Unique constraint: `[name, semester, academicYear]`.

## Dane testowe (seed)

- Admin: `admin@umg.edu.pl` / `Admin1234!`
- Wydział Mechaniczny z kierunkami EDST (specjalności DUT, ZEEW) i innymi
- Siatki godzin dla DUT i ZEEW, rok 2024/2025
- Budynki A (wykładowe/ćwiczeniowe), B (laboratoria), Centrum Sportu
- 12 prowadzących WM + 2 WF + 2 lektorzy

## Plan zajęć — architektura (następny cel)

### Koncepcja: wzorzec + konkretne tygodnie

```
ScheduleTemplate  →  wzorzec tygodnia (dayOfWeek, time, room, instructor, group)
        ↓  generator
ScheduleEntry     →  konkretny termin (date, status)
```

Admin układa wzorzec jednego tygodnia, system generuje wpisy na wszystkie tygodnie semestru.

### Modele (do dodania do schema.prisma)

```prisma
model SemesterCalendar {
  id             String      @id @default(uuid())
  academicYear   String      // "2024/2025"
  semesterType   SemesterType  // WINTER | SUMMER
  studyMode      StudyMode   // FULL_TIME | PART_TIME
  startDate      DateTime
  endDate        DateTime
  teachingWeeks  Int
  createdAt      DateTime    @default(now())

  @@unique([academicYear, semesterType, studyMode])
}

model PublicHoliday {
  id    String   @id @default(uuid())
  date  DateTime @unique
  name  String
}

model ScheduleTemplate {
  id           String      @id @default(uuid())
  dayOfWeek    DayOfWeek
  startTime    String      // "08:00"
  endTime      String      // "09:30"
  academicHours Int
  classType    ClassType
  weekType     WeekType    @default(EVERY)  // EVERY | EVEN | ODD

  curriculumEntryId  String
  curriculumEntry    CurriculumEntry @relation(...)
  roomId             String
  room               Room            @relation(...)
  instructorId       String
  instructor         Instructor      @relation(...)
  studentGroupId     String
  studentGroup       StudentGroup    @relation(...)

  academicYear  String
  semesterType  SemesterType
  studyMode     StudyMode

  entries  ScheduleEntry[]
  createdAt DateTime @default(now())
}

model ScheduleEntry {
  id          String         @id @default(uuid())
  date        DateTime       // konkretna data, np. 2025-10-07
  startTime   String
  endTime     String
  status      EntryStatus    @default(SCHEDULED)

  templateId     String?
  template       ScheduleTemplate? @relation(...)

  // może być nadpisane względem szablonu (zmiana sali/prowadzącego)
  roomId         String
  room           Room       @relation(...)
  instructorId   String
  instructor     Instructor @relation(...)

  curriculumEntryId String
  studentGroupId    String

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

enum EntryStatus {
  SCHEDULED   // zaplanowane
  CANCELLED   // odwołane
  MAKEUP      // odrobienie (dodane ręcznie, bez szablonu)
}

enum SemesterType {
  WINTER
  SUMMER
}
```

### Tryby studiów — dostępne okna czasowe

| Tryb | Dostępne dni | Godziny |
|---|---|---|
| FULL_TIME (stacjonarne) | Poniedziałek–Piątek | 07:00–20:00 |
| PART_TIME (niestacjonarne) | Piątek | 15:00–20:00 |
| PART_TIME (niestacjonarne) | Sobota–Niedziela | 07:00–20:00 |

Generator pomija sloty poza oknem czasowym danego trybu oraz dni będące świętami (`PublicHoliday`).

### Endpointy (do zaimplementowania)

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/schedule/templates` | CRUD wzorca tygodnia |
| POST | `/api/schedule/generate` | generuj wpisy na semestr z wzorca |
| GET | `/api/schedule/entries` | lista wpisów, ?from=&to=&groupId=&instructorId= |
| PUT | `/api/schedule/entries/:id` | edycja wpisu (sala, prowadzący, przeniesienie) |
| DELETE | `/api/schedule/entries/:id` | odwołaj zajęcia (status→CANCELLED) |
| GET/POST/DELETE | `/api/schedule/holidays` | zarządzanie dniami wolnymi |
| GET/POST/PUT/DELETE | `/api/schedule/calendars` | SemesterCalendar |

### Generator — logika

```
POST /api/schedule/generate
{
  templateId: string,
  calendarId: string   // SemesterCalendar z datami semestru
}

Algorytm:
1. Pobierz wzorzec (dayOfWeek, weekType, startTime...)
2. Pobierz kalendarz (startDate, endDate, studyMode)
3. Iteruj przez wszystkie tygodnie semestru:
   a. Wyznacz konkretną datę dla dayOfWeek w danym tygodniu
   b. Pomiń jeśli data to PublicHoliday
   c. Pomiń jeśli data poza oknem czasowym trybu studiów
   d. Pomiń jeśli weekType=EVEN i tydzień nieparzysty (i odwrotnie)
   e. Sprawdź konflikty (sala, prowadzący, grupa)
   f. Zapisz ScheduleEntry
4. Zwróć listę utworzonych + ewentualne ostrzeżenia
```

### Walidacja konfliktów (przy każdej zmianie)

Sprawdzaj przy POST/PUT ScheduleEntry i ScheduleTemplate:
- **Sala zajęta** — inny wpis w tej samej sali, tej samej dacie, nakładające się godziny
- **Prowadzący zajęty** — jw. dla instructorId
- **Grupa zajęta** — jw. dla studentGroupId
- Odpowiedź: `409 Conflict` z detalami (co koliduje, kiedy, z czym)

### Drag & drop — UI

- Wolne sloty → podświetl **zielono**
- Zajęte / poza oknem trybu / święto → podświetl **czerwono**
- Po upuszczeniu na nowy slot → walidacja na backendzie
- Dialog: **"Przenieść tylko te zajęcia (data X) czy cały semestr?"**
  - Tylko ten termin → aktualizuj jeden `ScheduleEntry` (date, room, instructor)
  - Cały semestr → aktualizuj `ScheduleTemplate` (dayOfWeek, startTime) + regeneruj wszystkie przyszłe `ScheduleEntry`

### Edycja zajęć (bez drag & drop)

Formularz edycji `ScheduleEntry`:
- Zmiana prowadzącego (walidacja: czy prowadzący wolny w tym terminie)
- Zmiana sali (walidacja: czy sala wolna, odpowiedni typ)
- Przeniesienie: podaj nową datę + godzinę (walidacja j.w.)
- Każda zmiana → natychmiastowa walidacja przed zapisem

## Czego NIE robić

- Nie twórz `new PrismaClient()` poza `src/lib/prisma.ts`
- Nie zmieniaj schematu Prisma bez wyraźnej prośby
- Nie implementuj Google OAuth
- Nie używaj `any` w TypeScript
