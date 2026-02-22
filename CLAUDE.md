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

## Czego NIE robić

- Nie twórz `new PrismaClient()` poza `src/lib/prisma.ts`
- Nie zmieniaj schematu Prisma bez wyraźnej prośby
- Nie implementuj Google OAuth
- Nie używaj `any` w TypeScript
