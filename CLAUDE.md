# CLAUDE.md — System Planisty (UMG)

## Tech Stack

| Warstwa     | Technologia                                         |
|-------------|-----------------------------------------------------|
| Backend     | Node.js + Express + TypeScript, port 4000           |
| Baza danych | PostgreSQL (Docker), ORM: Prisma                    |
| Auth        | JWT access (24h) + refresh (7d), bcryptjs           |
| Frontend    | React + TypeScript + Vite, port 5173                |
| UI          | shadcn/ui + Tailwind CSS                            |
| State       | TanStack Query (server), Zustand (auth + globalCtx) |

## Struktura projektu

```
planista3/
├── backend/
│   ├── prisma/schema.prisma   ← modele DB
│   └── src/
│       ├── index.ts
│       ├── lib/prisma.ts      ← singleton PrismaClient (jedyny)
│       ├── middleware/authenticate.ts
│       ├── routes/
│       └── controllers/
└── frontend/src/
    ├── api/
    ├── components/layout/     ← AppShell, Sidebar, ProtectedRoute
    ├── pages/
    ├── store/
    │   ├── authStore.ts       ← user, accessToken, refreshToken (persisted)
    │   └── academicYearStore.ts ← academicYear, semesterType (persisted)
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

`academicYear: string` (np. `"2024/2025"`) + `semesterType: 'WINTER'|'SUMMER'`  
`SEMESTER_TYPE_NUMBERS = { WINTER: [1,3,5,7], SUMMER: [2,4,6] }`  
Select w Sidebar (`"2024/2025|WINTER"`). Używany w: SchedulePage, GroupsPage, CurriculumPage.

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
Hierarchia: `StudentGroup` ma `parentGroupId` (relacja `"GroupHierarchy"`). Walidacja konfliktów sprawdza całą rodzinę (przodkowie + potomkowie).

## Dane testowe (seed)

- Admin: `admin@umg.edu.pl` / `Admin1234!`
- Wydział Mechaniczny, kierunki EDST (spec. DUT, ZEEW), rok 2024/2025
- Budynki A (wykładowe/ćwiczeniowe), B (laboratoria), Centrum Sportu
- 12 prowadzących WM + 2 WF + 2 lektorzy

## Architektura planu zajęć

### Koncepcja

```
ScheduleTemplate  →  wzorzec tygodnia (dayOfWeek, weekType, time, room, instructor, group)
        ↓  generator
ScheduleEntry     →  konkretny termin (date, status: SCHEDULED|CANCELLED|MAKEUP)
```

`weekType`: `EVERY | EVEN | ODD`

### Tryby studiów — okna czasowe

| Tryb | Dostępne dni | Godziny |
|---|---|---|
| FULL_TIME | Poniedziałek–Piątek | 07:00–20:00 |
| PART_TIME | Piątek | 15:00–20:00 |
| PART_TIME | Sobota–Niedziela | 07:00–20:00 |

Generator pomija święta (`PublicHoliday`) i sloty poza oknem trybu.

### Walidacja konfliktów

Przy każdym POST/PUT `ScheduleTemplate` i `ScheduleEntry`:
- **Sala zajęta** — ta sama sala, ta sama data/dzień, nakładające się godziny
- **Prowadzący zajęty** — jw.
- **Grupa zajęta** — jw., sprawdza całą rodzinę grup (`getGroupFamilyIds`)
- Odpowiedź: `409 Conflict` z detalami

### Endpointy

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/schedule/templates` | CRUD wzorca |
| POST | `/api/schedule/generate` | generuj wpisy na semestr |
| GET | `/api/schedule/entries` | `?from=&to=&groupId=&instructorId=` |
| PUT/DELETE | `/api/schedule/entries/:id` | edycja / odwołanie |
| GET/POST/DELETE | `/api/schedule/holidays` | dni wolne |
| GET/POST/PUT/DELETE | `/api/schedule/calendars` | SemesterCalendar |

### UI — drag & drop

- Wolne sloty → zielono; zajęte / poza oknem → czerwono; święta → cała kolumna czerwona
- Po upuszczeniu: dialog **"Przenieść tylko ten termin czy cały semestr?"**
  - Jeden termin → aktualizuj `ScheduleEntry`
  - Cały semestr → aktualizuj `ScheduleTemplate` + regeneruj przyszłe wpisy

## Czego NIE robić

- Nie twórz `new PrismaClient()` poza `src/lib/prisma.ts`
- Nie zmieniaj schematu Prisma bez wyraźnej prośby
- Nie implementuj Google OAuth
- Nie używaj `any` w TypeScript
