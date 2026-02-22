# CLAUDE.md — Instrukcja projektu: System Planisty

## Kontekst projektu

Buduję system zarządzania planem zajęć dla uczelni wyższej (Uniwersytet Morski w Gdyni).
Aktualny etap: **budowanie endpointów REST API**.

---

## Tech Stack

| Warstwa     | Technologia                     |
|-------------|---------------------------------|
| Backend     | Node.js + Express + TypeScript  |
| Baza danych | PostgreSQL                      |
| ORM         | Prisma                          |
| Auth        | JWT (następny etap)             |
| Frontend    | React + TypeScript (później)    |

---

## Struktura projektu

```
scheduler-app/
├── CLAUDE.md
├── docker-compose.yml
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── .env
    ├── prisma/
    │   ├── schema.prisma      ✅ gotowe
    │   └── seed.ts            ✅ gotowe — dane z PDF w bazie
    └── src/
        ├── index.ts           ← entry point (uzupełnij jeśli brak)
        ├── lib/
        │   └── prisma.ts      ← singleton klienta Prisma
        ├── routes/            ← tu tworzymy endpointy
        ├── controllers/       ← logika endpointów
        └── middleware/        ← na później (auth)
```

---

## Stan projektu

- [x] Schemat Prisma — gotowy
- [x] Migracja — wykonana
- [x] Seed — dane z PDF w bazie
- [ ] Endpointy REST — **aktualny cel**
- [ ] Walidacja siatki godzin
- [ ] Auth JWT
- [ ] Frontend

---

## Aktualny cel: Endpointy REST

Buduj w tej kolejności. Każdy zasób ma pełne CRUD.

---

### KROK 1 — Setup Express (src/index.ts)

Jeśli jeszcze nie istnieje lub jest pusty, utwórz:

```typescript
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import facultyRoutes from './routes/faculties'
import fieldOfStudyRoutes from './routes/fieldsOfStudy'
import specializationRoutes from './routes/specializations'
import buildingRoutes from './routes/buildings'
import instructorRoutes from './routes/instructors'
import curriculumRoutes from './routes/curriculum'
import subjectRoutes from './routes/subjects'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

app.use('/api/faculties', facultyRoutes)
app.use('/api/fields-of-study', fieldOfStudyRoutes)
app.use('/api/specializations', specializationRoutes)
app.use('/api/buildings', buildingRoutes)
app.use('/api/instructors', instructorRoutes)
app.use('/api/curriculum', curriculumRoutes)
app.use('/api/subjects', subjectRoutes)

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
```

---

### KROK 2 — Singleton Prisma (src/lib/prisma.ts)

Utwórz jeden współdzielony klient — nie twórz new PrismaClient() w każdym pliku:

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
export default prisma
```

---

### KROK 3 — Zasoby organizacyjne

Buduj po kolei. Każdy zasób = plik w routes/ + plik w controllers/.

#### 3a. Faculties (/api/faculties)

| Metoda | Ścieżka | Opis                              |
|--------|---------|-----------------------------------|
| GET    | /       | lista wydziałów                   |
| GET    | /:id    | wydział z fieldsOfStudy (include) |
| POST   | /       | utwórz wydział                    |
| PUT    | /:id    | edytuj wydział                    |
| DELETE | /:id    | usuń (tylko jeśli brak kierunków) |

#### 3b. Fields of Study (/api/fields-of-study)

| Metoda | Ścieżka | Opis                                 |
|--------|---------|--------------------------------------|
| GET    | /       | lista, query param: ?facultyId=      |
| GET    | /:id    | kierunek ze specializations (include)|
| POST   | /       | utwórz (wymaga facultyId)            |
| PUT    | /:id    | edytuj                               |
| DELETE | /:id    | usuń (tylko jeśli brak specjalności) |

#### 3c. Specializations (/api/specializations)

| Metoda | Ścieżka | Opis                                      |
|--------|---------|-------------------------------------------|
| GET    | /       | lista, query param: ?fieldOfStudyId=      |
| GET    | /:id    | specjalność z curriculumVersions (include)|
| POST   | /       | utwórz (wymaga fieldOfStudyId)            |
| PUT    | /:id    | edytuj                                    |
| DELETE | /:id    | usuń (tylko jeśli brak wersji planów)     |

#### 3d. Buildings + Rooms (/api/buildings)

| Metoda | Ścieżka              | Opis                                    |
|--------|----------------------|-----------------------------------------|
| GET    | /                    | lista budynków z salami                 |
| GET    | /:id                 | jeden budynek z salami                  |
| POST   | /                    | utwórz (facultyId opcjonalne)           |
| PUT    | /:id                 | edytuj                                  |
| DELETE | /:id                 | usuń                                    |
| GET    | /:id/rooms           | sale w budynku                          |
| POST   | /:id/rooms           | dodaj salę                              |
| PUT    | /:id/rooms/:roomId   | edytuj salę                             |
| DELETE | /:id/rooms/:roomId   | usuń salę                               |

#### 3e. Instructors (/api/instructors)

| Metoda | Ścieżka | Opis                                      |
|--------|---------|-------------------------------------------|
| GET    | /       | lista, query param: ?facultyId=           |
| GET    | /:id    | jeden prowadzący                          |
| POST   | /       | utwórz (facultyId opcjonalne — dla WF)   |
| PUT    | /:id    | edytuj                                    |
| DELETE | /:id    | usuń                                      |

---

### KROK 4 — Siatka godzin (/api/curriculum)

To najważniejsza część systemu.

| Metoda | Ścieżka                  | Opis                                      |
|--------|--------------------------|-------------------------------------------|
| GET    | /versions                | lista wersji planów                       |
| GET    | /versions/:id            | wersja z pełną siatką godzin             |
| POST   | /versions                | utwórz nową wersję planu                 |
| PUT    | /versions/:id            | edytuj wersję (np. zmień isActive)       |
| DELETE | /versions/:id            | usuń wersję                               |
| GET    | /versions/:id/entries    | siatka, opcjonalnie ?semester=            |
| POST   | /versions/:id/entries    | dodaj przedmiot do siatki                |
| PUT    | /entries/:id             | edytuj godziny przedmiotu                |
| DELETE | /entries/:id             | usuń przedmiot z siatki                  |
| GET    | /versions/:id/validate   | walidacja zgodności godzin               |

#### Format odpowiedzi GET /versions/:id/entries

Grupuj po semestrach:

```typescript
{
  data: {
    version: { id, academicYear, studyMode, degreeLevel, totalSemesters },
    semesters: [
      {
        semester: 1,
        totalEcts: number,
        entries: [
          {
            id,
            orderInSemester,
            subject: { id, name, code },
            instructor: { id, firstName, lastName, title } | null,
            hoursLecture,    // W
            hoursExercise,   // C
            hoursLab,        // L
            hoursProject,    // P
            hoursSeminar,    // S
            totalHours,      // W+C+L+P+S — oblicz w backendzie
            ects,
            assessmentType
          }
        ]
      }
    ]
  }
}
```

#### Format odpowiedzi GET /versions/:id/validate

```typescript
{
  data: {
    isValid: boolean,
    errors: [
      {
        semester: number,
        entryId: string,
        subjectName: string,
        issue: string  // "Brak prowadzącego", "ECTS = 0 przy godzinach > 0"
      }
    ],
    warnings: [
      {
        semester: number,
        issue: string  // "Semestr 3 ma 0 punktów ECTS"
      }
    ]
  }
}
```

Sprawdzaj:
- czy każdy wpis ma ects > 0 jeśli ma jakiekolwiek godziny
- czy suma godzin (W+C+L+P+S) > 0 dla każdego wpisu
- czy żaden semestr nie ma łącznie 0 ECTS

---

### KROK 5 — Subjects (/api/subjects)

| Metoda | Ścieżka | Opis                                          |
|--------|---------|-----------------------------------------------|
| GET    | /       | lista, query param: ?search= (szukaj nazwy)  |
| GET    | /:id    | jeden przedmiot                               |
| POST   | /       | utwórz                                        |
| PUT    | /:id    | edytuj                                        |
| DELETE | /:id    | usuń (tylko jeśli nie używany w siatce)       |

---

## Format odpowiedzi API — zawsze

```typescript
// sukces
{ data: T, message?: string }

// błąd
{ error: string, details?: unknown }
```

Kody błędów:
- 400 — brakujące/nieprawidłowe pola
- 404 — zasób nie istnieje
- 409 — konflikt (duplikat unikalnego pola)
- 500 — błąd serwera

---

## Konwencje kodu

- Wszystkie pliki TypeScript, zero użycia "any"
- Jeden plik route + jeden plik controller per zasób
- Prisma tylko przez src/lib/prisma.ts (singleton)
- Każdy controller owinięty w try/catch
- async/await wszędzie, bez .then().catch()

Wzorzec kontrolera:

```typescript
import { Request, Response } from 'express'
import prisma from '../lib/prisma'

export const getAll = async (req: Request, res: Response) => {
  try {
    const items = await prisma.faculty.findMany({
      include: { fieldsOfStudy: true }
    })
    res.json({ data: items })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
```

---

## Zmienne środowiskowe (.env)

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/scheduler_db"
PORT=4000
```

---

## Czego NIE rób

- Nie twórz plików frontendowych
- Nie dodawaj JWT — to kolejny etap po endpointach
- Nie twórz new PrismaClient() poza src/lib/prisma.ts
- Nie używaj "any" w TypeScript
- Nie obsługuj przedmiotów do wyboru (oznaczonych * w PDF)
- Nie zmieniaj schematu Prisma bez wyraźnej prośby

---

## Plan zajęć — schemat i walidacja (następny etap po endpointach)

### Kontekst

Siatka godzin = źródło prawdy (zaseedowana z PDF).
Plan zajęć = konkretne zajęcia generowane na jej podstawie.

```
Siatka godzin (CurriculumEntry)
        ↓
Plan zajęć (ScheduleEntry)
        ↓
Walidacja: suma godzin w semestrze musi zgadzać się z siatką
```

### Godzina dydaktyczna (akademicka)

1 godzina w siatce = 45 min zajęć + 15 min przerwy = 60 min zegarowych.
Przechowuj czas w minutach zegarowych w bazie. Przelicznik jako stała w kodzie:

```typescript
// src/lib/constants.ts
export const ACADEMIC_HOUR_MINUTES = 60      // 45 min zajęć + 15 min przerwy
export const ACADEMIC_HOUR_DURATION = 45     // rzeczywisty czas zajęć
export const BREAK_DURATION = 15             // przerwa
```

### Schemat tabeli ScheduleEntry (do dodania do schema.prisma)

```prisma
model ScheduleEntry {
  id                  String            @id @default(uuid())

  // Powiązanie z siatką — skąd pochodzi ten wpis
  curriculumEntry     CurriculumEntry   @relation(fields: [curriculumEntryId], references: [id])
  curriculumEntryId   String

  // Kiedy
  dayOfWeek           DayOfWeek
  startTime           String            // "08:00" — czas zegarowy
  endTime             String            // "09:30" — startTime + N * 60 min

  // Ile godzin dydaktycznych w tym bloku (np. 2 = 90 min zegarowych)
  academicHours       Int

  // Forma zajęć z siatki (W/C/L/P/S) — jeden ScheduleEntry = jedna forma
  classType           ClassType

  // Zasoby
  room                Room              @relation(fields: [roomId], references: [id])
  roomId              String
  instructor          Instructor        @relation(fields: [instructorId], references: [id])
  instructorId        String

  // Przynależność do semestru/planu
  semester            Int
  academicYear        String            // "2024/2025"
  weekType            WeekType          @default(EVERY)  // co tydzień / parzyste / nieparzyste

  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt
}

enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

enum ClassType {
  LECTURE    // W
  EXERCISE   // C
  LAB        // L
  PROJECT    // P
  SEMINAR    // S
}

enum WeekType {
  EVERY      // co tydzień
  EVEN       // tygodnie parzyste
  ODD        // tygodnie nieparzyste
}
```

Oraz dopisz relacje do istniejących modeli:

```prisma
// W CurriculumEntry dopisz:
scheduleEntries  ScheduleEntry[]

// W Room dopisz:
scheduleEntries  ScheduleEntry[]

// W Instructor dopisz:
scheduleEntries  ScheduleEntry[]
```

### Logika walidacji (src/services/scheduleValidation.ts)

Walidacja jest TWARDA — blokuje zapis gdy przekroczono godziny z siatki.
Walidacja działa na poziomie semestru — liczy sumy godzin.

Przed każdym POST /schedule-entries wykonaj:

#### 1. Sprawdź limit godzin (najważniejsze)

```typescript
// Pobierz ile godzin danego typu jest już zaplanowanych w semestrze
const planned = await prisma.scheduleEntry.aggregate({
  where: {
    curriculumEntryId: dto.curriculumEntryId,
    classType: dto.classType,
    semester: dto.semester,
    academicYear: dto.academicYear,
  },
  _sum: { academicHours: true }
})

// Pobierz limit z siatki
const entry = await prisma.curriculumEntry.findUnique(...)
const limit = getHoursLimit(entry, dto.classType)
// getHoursLimit zwraca np. entry.hoursLecture dla ClassType.LECTURE

const alreadyPlanned = planned._sum.academicHours ?? 0
if (alreadyPlanned + dto.academicHours > limit) {
  // BLOKUJ ZAPIS — zwróć 422
  return {
    error: 'Przekroczono limit godzin z siatki',
    details: {
      classType: dto.classType,
      limit,
      alreadyPlanned,
      requested: dto.academicHours,
      remaining: limit - alreadyPlanned
    }
  }
}
```

#### 2. Sprawdź konflikt sali

```typescript
// Czy sala jest wolna w tym czasie?
const roomConflict = await prisma.scheduleEntry.findFirst({
  where: {
    roomId: dto.roomId,
    dayOfWeek: dto.dayOfWeek,
    academicYear: dto.academicYear,
    semester: dto.semester,
    // nakładające się godziny
    AND: [
      { startTime: { lt: dto.endTime } },
      { endTime: { gt: dto.startTime } }
    ]
  }
})
if (roomConflict) → 409 Conflict
```

#### 3. Sprawdź konflikt prowadzącego

```typescript
const instructorConflict = await prisma.scheduleEntry.findFirst({
  where: {
    instructorId: dto.instructorId,
    dayOfWeek: dto.dayOfWeek,
    academicYear: dto.academicYear,
    AND: [
      { startTime: { lt: dto.endTime } },
      { endTime: { gt: dto.startTime } }
    ]
  }
})
if (instructorConflict) → 409 Conflict
```

#### 4. Sprawdź typ sali vs typ zajęć

```typescript
const roomTypeMap: Record<ClassType, RoomType[]> = {
  LECTURE:  [RoomType.LECTURE],
  EXERCISE: [RoomType.EXERCISE, RoomType.LECTURE],
  LAB:      [RoomType.LAB, RoomType.COMPUTER_LAB],
  PROJECT:  [RoomType.EXERCISE, RoomType.COMPUTER_LAB, RoomType.SEMINAR],
  SEMINAR:  [RoomType.SEMINAR, RoomType.EXERCISE],
}
// Jeśli room.type nie jest w roomTypeMap[classType] → 400
```

### Endpointy planu zajęć (/api/schedule)

| Metoda | Ścieżka                          | Opis                                      |
|--------|----------------------------------|-------------------------------------------|
| GET    | /                                | lista, ?semester=&academicYear=           |
| GET    | /:id                             | jeden wpis                                |
| POST   | /                                | dodaj zajęcia (walidacja twarda)          |
| PUT    | /:id                             | edytuj (ponowna walidacja)                |
| DELETE | /:id                             | usuń                                      |
| GET    | /summary/:curriculumVersionId    | podsumowanie: zaplanowane vs siatka       |

#### Format GET /summary/:curriculumVersionId

Pokazuje postęp planowania — ile godzin zaplanowano vs ile wymaga siatka:

```typescript
{
  data: {
    semesters: [
      {
        semester: 1,
        subjects: [
          {
            subjectName: "Matematyka I",
            classType: "LECTURE",
            planned: 15,      // ile godzin już w planie
            required: 30,     // ile wymaga siatka
            remaining: 15,    // ile jeszcze brakuje
            completed: false
          }
        ]
      }
    ]
  }
}
```

### Kod odpowiedzi walidacji

- `422 Unprocessable Entity` — przekroczono limit godzin z siatki
- `409 Conflict` — konflikt sali lub prowadzącego
- `400 Bad Request` — zły typ sali dla formy zajęć

---

## Grupy studentów — schemat i logika

### Decyzje projektowe

| Kwestia | Decyzja |
|---|---|
| Okres | Per semestr (numer semestru 1–7 ze siatki) |
| Hierarchia | Tak — wykład → ćwiczenia → laboratoria |
| Sale | Priorytet budynki wydziału, fallback ogólnouczelniane |
| Specjalność | Opcjonalna — rok 1 i 2 przypisane tylko do kierunku |

### Migracja — dodaj do schema.prisma

```prisma
model StudentGroup {
  id               String          @id @default(uuid())

  // Nazwa generowana automatycznie np. "EDST-1-W", "EDST-1-C-A", "EDST-1-L-A1"
  name             String

  // Przynależność do struktury uczelni
  fieldOfStudy     FieldOfStudy    @relation(fields: [fieldOfStudyId], references: [id])
  fieldOfStudyId   String

  // Opcjonalna — null dla niższych lat (rok 1, 2) gdzie nie ma jeszcze specjalności
  specialization   Specialization? @relation(fields: [specializationId], references: [id])
  specializationId String?

  // Rok studiów i semestr ze siatki godzin (1–7)
  studyYear        Int             // 1, 2, 3, 4
  semester         Int             // 1–7 (numer ze siatki)
  academicYear     String          // "2024/2025"

  // Typ grupy — decyduje jakie zajęcia obejmuje
  type             GroupType

  // Liczba studentów w grupie
  size             Int

  // Hierarchia — grupa ćwiczeniowa jest dzieckiem grupy wykładowej
  parentGroup      StudentGroup?   @relation("GroupHierarchy", fields: [parentGroupId], references: [id])
  parentGroupId    String?
  subGroups        StudentGroup[]  @relation("GroupHierarchy")

  // Preferowana sala (sugerowana przez system, admin może zmienić)
  preferredRoom    Room?           @relation(fields: [preferredRoomId], references: [id])
  preferredRoomId  String?

  scheduleEntries  ScheduleEntry[]
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@unique([name, semester, academicYear])
}

enum GroupType {
  LECTURE     // W — cały rok razem
  EXERCISE    // C — podgrupa
  LAB         // L i komputerowa
  PROJECT     // P
  SEMINAR     // S
}
```

Dopisz relacje do istniejących modeli:

```prisma
// W FieldOfStudy dopisz:
studentGroups    StudentGroup[]

// W Specialization dopisz:
studentGroups    StudentGroup[]

// W Room dopisz:
preferredGroups  StudentGroup[]
```

### Endpointy grup (/api/groups)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | / | lista grup, ?fieldOfStudyId= &semester= &academicYear= |
| GET | /:id | jedna grupa z podgrupami |
| POST | /generate | generuj propozycję grup (nie zapisuje) |
| POST | /confirm | zatwierdź i zapisz propozycję |
| PUT | /:id | edytuj grupę (nazwa, size, sala) |
| DELETE | /:id | usuń grupę (tylko jeśli brak ScheduleEntries) |
| POST | / | utwórz grupę ręcznie |

### Endpoint POST /api/groups/generate

Przyjmuje:

```typescript
{
  fieldOfStudyId: string,
  specializationId?: string,      // null dla roku 1 i 2
  studyYear: number,              // 1, 2, 3, 4
  semester: number,               // 1–7
  academicYear: string,           // "2024/2025"
  totalStudents: number           // łączna liczba studentów
}
```

Algorytm generowania:

```
1. Pobierz siatke godzin dla danego semestru
   → jakie typy zajęć występują (W, C, L, P, S)?

2. Znajdź dostępne sale — priorytet:
   a) sale w budynkach przypisanych do wydziału kierunku
   b) sale ogólnouczelniane (facultyId = null)
   Wyjątek: GroupType.LECTURE → tylko sale typu LECTURE
             GroupType.LAB    → sale typu LAB lub COMPUTER_LAB

3. Dla każdego typu zajęć wylicz liczbę grup:
   → znajdź największą salę pasującego typu
   → groupCount = ceil(totalStudents / roomCapacity)
   → groupSize  = ceil(totalStudents / groupCount)

4. Wygeneruj nazwy grup:
   → LECTURE:  "EDST-1-W"
   → EXERCISE: "EDST-1-C-A", "EDST-1-C-B"
   → LAB:      "EDST-1-L-A1", "EDST-1-L-A2", "EDST-1-L-B1", "EDST-1-L-B2"
   → PROJECT:  "EDST-1-P-A", "EDST-1-P-B"
   → SEMINAR:  "EDST-1-S-A"

5. Zbuduj hierarchię:
   → grupy LAB są dziećmi grup EXERCISE (A1,A2 → A; B1,B2 → B)
   → grupy EXERCISE, LAB, PROJECT, SEMINAR są dziećmi grupy LECTURE

6. Zwróć propozycję (nie zapisuj jeszcze do bazy)
```

Format odpowiedzi:

```typescript
{
  data: {
    proposal: [
      {
        name: "EDST-1-W",
        type: "LECTURE",
        size: 60,
        parentName: null,
        suggestedRoom: { id, number, capacity, building: { name } }
      },
      {
        name: "EDST-1-C-A",
        type: "EXERCISE",
        size: 30,
        parentName: "EDST-1-W",
        suggestedRoom: { id, number, capacity, building: { name } }
      },
      {
        name: "EDST-1-L-A1",
        type: "LAB",
        size: 15,
        parentName: "EDST-1-C-A",
        suggestedRoom: { id, number, capacity, building: { name } }
      }
      // ...
    ],
    meta: {
      totalStudents: 60,
      semester: 1,
      academicYear: "2024/2025",
      groupCounts: {
        LECTURE: 1,
        EXERCISE: 2,
        LAB: 4,
        PROJECT: 2,
        SEMINAR: 1
      }
    }
  }
}
```

### Endpoint POST /api/groups/confirm

Admin może zmodyfikować propozycję (zmienić size, salę, nazwę) i wysłać do zatwierdzenia.
System zapisuje wszystkie grupy w jednej transakcji Prisma:

```typescript
await prisma.$transaction(
  proposal.map(group =>
    prisma.studentGroup.create({ data: group })
  )
)
```

Jeśli którakolwiek grupa już istnieje (@@unique) → 409 Conflict z informacją która.

### Logika nazewnictwa grup

```typescript
// src/lib/groupNaming.ts

const EXERCISE_LABELS = ['A', 'B', 'C', 'D', 'E']
const LAB_SUFFIXES = ['1', '2', '3', '4']

export const generateGroupName = (
  fieldShortName: string,  // "EDST"
  studyYear: number,       // 1
  type: GroupType,
  index: number,           // 0, 1, 2...
  parentIndex?: number     // dla LAB — indeks grupy ćwiczeniowej
): string => {
  const base = `${fieldShortName}-${studyYear}`
  switch (type) {
    case 'LECTURE':  return `${base}-W`
    case 'EXERCISE': return `${base}-C-${EXERCISE_LABELS[index]}`
    case 'LAB':      return `${base}-L-${EXERCISE_LABELS[parentIndex!]}${LAB_SUFFIXES[index]}`
    case 'PROJECT':  return `${base}-P-${EXERCISE_LABELS[index]}`
    case 'SEMINAR':  return `${base}-S-${EXERCISE_LABELS[index]}`
  }
}
```

### Walidacja przy tworzeniu grup

- `totalStudents` musi być > 0
- `semester` musi istnieć w siatce godzin dla danego kierunku/specjalności
- Jeśli brak sal odpowiedniego typu w bazie → ostrzeżenie w propozycji, nie blokuj
- Nie można mieć dwóch grup z tą samą nazwą w tym samym semestrze i roku akademickim (@@unique)

---

## Seed — dane testowe: Budynki, Sale, Prowadzący

Dodaj do `backend/prisma/seed.ts` po istniejącym seedzie.

### Budynki i Sale

```typescript
// Budynki Wydziału Mechanicznego
const buildingA = await prisma.building.upsert({
  where: { name: 'Budynek A' },
  update: {},
  create: {
    name: 'Budynek A',
    address: 'ul. Morska 81-87, Gdynia',
    facultyId: wydzialMechaniczny.id,
  },
})

const buildingB = await prisma.building.upsert({
  where: { name: 'Budynek B' },
  update: {},
  create: {
    name: 'Budynek B',
    address: 'ul. Morska 81-87, Gdynia',
    facultyId: wydzialMechaniczny.id,
  },
})

// Budynek ogólnouczelniany — brak facultyId
const centrumSportu = await prisma.building.upsert({
  where: { name: 'Centrum Sportu' },
  update: {},
  create: {
    name: 'Centrum Sportu',
    address: 'ul. Morska 81-87, Gdynia',
    facultyId: null,
  },
})

// Sale Budynku A
const saleA = [
  { number: 'A101', type: 'LECTURE',     capacity: 120 },
  { number: 'A102', type: 'LECTURE',     capacity: 80  },
  { number: 'A103', type: 'LECTURE',     capacity: 60  },
  { number: 'A201', type: 'EXERCISE',    capacity: 30  },
  { number: 'A202', type: 'EXERCISE',    capacity: 30  },
  { number: 'A203', type: 'EXERCISE',    capacity: 30  },
  { number: 'A204', type: 'EXERCISE',    capacity: 30  },
  { number: 'A301', type: 'SEMINAR',     capacity: 20  },
  { number: 'A302', type: 'SEMINAR',     capacity: 20  },
]

for (const sala of saleA) {
  await prisma.room.upsert({
    where: { number_buildingId: { number: sala.number, buildingId: buildingA.id } },
    update: {},
    create: { ...sala, buildingId: buildingA.id },
  })
}

// Sale Budynku B — laboratoria
const saleB = [
  { number: 'B101', type: 'LAB',          capacity: 15 },
  { number: 'B102', type: 'LAB',          capacity: 15 },
  { number: 'B103', type: 'LAB',          capacity: 15 },
  { number: 'B104', type: 'LAB',          capacity: 15 },
  { number: 'B201', type: 'COMPUTER_LAB', capacity: 25 },
  { number: 'B202', type: 'COMPUTER_LAB', capacity: 25 },
  { number: 'B301', type: 'EXERCISE',     capacity: 30 },
  { number: 'B302', type: 'EXERCISE',     capacity: 30 },
]

for (const sala of saleB) {
  await prisma.room.upsert({
    where: { number_buildingId: { number: sala.number, buildingId: buildingB.id } },
    update: {},
    create: { ...sala, buildingId: buildingB.id },
  })
}

// Sale Centrum Sportu
const saleSport = [
  { number: 'Hala Główna',      type: 'SPORTS', capacity: 100 },
  { number: 'Siłownia',         type: 'SPORTS', capacity: 30  },
  { number: 'Sala Gimnastyczna', type: 'SPORTS', capacity: 40  },
]

for (const sala of saleSport) {
  await prisma.room.upsert({
    where: { number_buildingId: { number: sala.number, buildingId: centrumSportu.id } },
    update: {},
    create: { ...sala, buildingId: centrumSportu.id },
  })
}
```

### Prowadzący

```typescript
// Prowadzący Wydziału Mechanicznego
const prowadzacyWM = [
  { firstName: 'Jan',      lastName: 'Kowalski',    title: 'prof. dr hab.',  email: 'j.kowalski@umg.edu.pl'    },
  { firstName: 'Anna',     lastName: 'Nowak',       title: 'dr hab.',        email: 'a.nowak@umg.edu.pl'        },
  { firstName: 'Piotr',    lastName: 'Wiśniewski',  title: 'dr',             email: 'p.wisniewski@umg.edu.pl'   },
  { firstName: 'Marta',    lastName: 'Wójcik',      title: 'dr',             email: 'm.wojcik@umg.edu.pl'       },
  { firstName: 'Tomasz',   lastName: 'Kamiński',    title: 'dr inż.',        email: 't.kaminski@umg.edu.pl'     },
  { firstName: 'Katarzyna',lastName: 'Lewandowska', title: 'dr inż.',        email: 'k.lewandowska@umg.edu.pl'  },
  { firstName: 'Marek',    lastName: 'Zieliński',   title: 'mgr inż.',       email: 'm.zielinski@umg.edu.pl'    },
  { firstName: 'Agnieszka',lastName: 'Szymańska',   title: 'mgr inż.',       email: 'a.szymanska@umg.edu.pl'    },
  { firstName: 'Robert',   lastName: 'Woźniak',     title: 'dr',             email: 'r.wozniak@umg.edu.pl'      },
  { firstName: 'Monika',   lastName: 'Dąbrowska',   title: 'dr inż.',        email: 'm.dabrowska@umg.edu.pl'    },
  { firstName: 'Krzysztof',lastName: 'Kozłowski',   title: 'prof. dr hab.',  email: 'k.kozlowski@umg.edu.pl'    },
  { firstName: 'Ewa',      lastName: 'Jankowska',   title: 'dr',             email: 'e.jankowska@umg.edu.pl'    },
]

for (const p of prowadzacyWM) {
  await prisma.instructor.upsert({
    where: { email: p.email },
    update: {},
    create: { ...p, facultyId: wydzialMechaniczny.id },
  })
}

// Instruktorzy WF — brak wydziału (facultyId: null)
const instruktorzyWF = [
  { firstName: 'Zbigniew', lastName: 'Adamski',   title: 'mgr', email: 'z.adamski@umg.edu.pl'  },
  { firstName: 'Joanna',   lastName: 'Michalska', title: 'mgr', email: 'j.michalska@umg.edu.pl' },
]

for (const p of instruktorzyWF) {
  await prisma.instructor.upsert({
    where: { email: p.email },
    update: {},
    create: { ...p, facultyId: null },
  })
}

// Lektorzy języka angielskiego — brak wydziału
const lektorzy = [
  { firstName: 'Sarah',  lastName: 'Johnson', title: 'mgr', email: 's.johnson@umg.edu.pl' },
  { firstName: 'Michał', lastName: 'Nowicki', title: 'mgr', email: 'm.nowicki@umg.edu.pl'  },
]

for (const p of lektorzy) {
  await prisma.instructor.upsert({
    where: { email: p.email },
    update: {},
    create: { ...p, facultyId: null },
  })
}
```

### Uruchomienie seedu

```bash
cd backend
npx ts-node prisma/seed.ts

# Sprawdź w Prisma Studio
npx prisma studio
```

### Co masz po seedzie

| Zasób | Liczba |
|---|---|
| Budynki | 3 (A, B, Centrum Sportu) |
| Sale wykładowe | 3 (60–120 miejsc) |
| Sale ćwiczeniowe | 6 (po 30 miejsc) |
| Laboratoria | 4 (po 15 miejsc) |
| Sale komputerowe | 2 (po 25 miejsc) |
| Sale sportowe | 3 |
| Prowadzący WM | 12 |
| Instruktorzy WF | 2 |
| Lektorzy | 2 |

---

## Auth JWT

### Decyzje projektowe

| Kwestia | Decyzja |
|---|---|
| Logowanie | Email + hasło (bcrypt) |
| Token | JWT access token (24h) + refresh token (7d) |
| Role | ADMIN, INSTRUCTOR, STUDENT, DEAN_OFFICE |
| OAuth | Google — dodać później |

### Role i uprawnienia

| Endpoint | ADMIN | DEAN_OFFICE | INSTRUCTOR | STUDENT |
|---|---|---|---|---|
| GET /curriculum | ✅ | ✅ | ✅ | ✅ |
| POST/PUT/DELETE /curriculum | ✅ | ❌ | ❌ | ❌ |
| GET /schedule | ✅ | ✅ | ✅ | ✅ |
| POST/PUT /schedule | ✅ | ❌ | własne zajęcia | ❌ |
| DELETE /schedule | ✅ | ❌ | ❌ | ❌ |
| GET /groups | ✅ | ✅ | ✅ | własna grupa |
| POST/PUT/DELETE /groups | ✅ | ❌ | ❌ | ❌ |
| /faculties, /buildings, /instructors | ✅ | ✅ (GET) | ✅ (GET) | ❌ |
| /auth/register | ✅ tylko admin tworzy konta | - | - | - |

### Migracja — dodaj do schema.prisma

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  password     String
  role         Role
  name         String

  // Powiązanie z prowadzącym (jeśli role = INSTRUCTOR)
  instructor   Instructor? @relation(fields: [instructorId], references: [id])
  instructorId String?     @unique

  // Powiązanie z grupą (jeśli role = STUDENT)
  studentGroup   StudentGroup? @relation(fields: [studentGroupId], references: [id])
  studentGroupId String?

  refreshTokens  RefreshToken[]

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
}

enum Role {
  ADMIN
  INSTRUCTOR
  STUDENT
  DEAN_OFFICE
}
```

Dopisz relacje do istniejących modeli:

```prisma
// W Instructor dopisz:
user  User?

// W StudentGroup dopisz:
users User[]
```

### Endpointy auth (/api/auth)

| Metoda | Ścieżka | Dostęp | Opis |
|--------|---------|--------|------|
| POST | /register | ADMIN only | tworzy konto użytkownika |
| POST | /login | publiczny | zwraca access + refresh token |
| POST | /refresh | publiczny | wymienia refresh na nowy access token |
| POST | /logout | zalogowany | unieważnia refresh token |
| GET | /me | zalogowany | dane zalogowanego użytkownika |

### Format tokenów

```typescript
// Access token payload
{
  userId: string,
  role: Role,
  instructorId?: string,   // jeśli INSTRUCTOR
  studentGroupId?: string  // jeśli STUDENT
}

// POST /login — odpowiedź
{
  data: {
    accessToken: string,   // ważny 24h
    refreshToken: string,  // ważny 7d
    user: {
      id, email, name, role
    }
  }
}
```

### Middleware

Utwórz `src/middleware/authenticate.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

export interface AuthRequest extends Request {
  userId?: string
  role?: Role
  instructorId?: string
  studentGroupId?: string
}

// Weryfikuje token — blokuje jeśli brak/nieprawidłowy
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Brak tokenu' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
    req.userId = payload.userId
    req.role = payload.role
    req.instructorId = payload.instructorId
    req.studentGroupId = payload.studentGroupId
    next()
  } catch {
    return res.status(401).json({ error: 'Token nieważny lub wygasł' })
  }
}

// Sprawdza czy użytkownik ma wymaganą rolę
export const authorize = (...roles: Role[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    next()
  }
```

### Użycie middleware w routach

```typescript
import { authenticate, authorize } from '../middleware/authenticate'

// Tylko odczyt — wszyscy zalogowani
router.get('/', authenticate, getAll)

// Tylko admin
router.post('/', authenticate, authorize('ADMIN'), create)

// Admin lub prowadzący (własne zajęcia — logika w controllerze)
router.put('/:id', authenticate, authorize('ADMIN', 'INSTRUCTOR'), update)
```

### Zmienne środowiskowe — dopisz do .env

```env
JWT_SECRET="twoj-bardzo-tajny-klucz-minimum-32-znaki"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="inny-tajny-klucz-do-refresh-tokenow"
JWT_REFRESH_EXPIRES_IN="7d"
```

### Seed — domyślny admin

Dopisz na końcu `prisma/seed.ts`:

```typescript
import bcrypt from 'bcryptjs'

const hashedPassword = await bcrypt.hash('Admin1234!', 12)

await prisma.user.upsert({
  where: { email: 'admin@umg.edu.pl' },
  update: {},
  create: {
    email: 'admin@umg.edu.pl',
    password: hashedPassword,
    name: 'Administrator',
    role: 'ADMIN',
  },
})

console.log('✅ Admin: admin@umg.edu.pl / Admin1234!')
```

### Kolejność implementacji

1. Migracja — dodaj `User`, `RefreshToken`, enum `Role` do schema.prisma
2. `npx prisma migrate dev --name add_auth`
3. `src/routes/auth.ts` + `src/controllers/auth.ts`
4. `src/middleware/authenticate.ts`
5. Dodaj `authenticate` + `authorize` do istniejących routerów
6. Dopisz seed admina i uruchom `npx ts-node prisma/seed.ts`
7. Przetestuj: POST /api/auth/login → użyj tokenu w innych endpointach

### Czego NIE rób na tym etapie

- Nie implementuj Google OAuth — to osobny krok po fronendzie
- Nie wysyłaj maili przy rejestracji — zbędna złożoność na razie
- Rejestrację może wykonać tylko ADMIN — nie ma publicznego /register

---

## Frontend — React + TypeScript + shadcn/ui

### Stack

| Technologia | Rola |
|---|---|
| React + TypeScript | Framework |
| Vite | Bundler |
| React Router v6 | Routing |
| shadcn/ui + Tailwind | Komponenty i style |
| TanStack Query | Fetching i cache danych z API |
| Axios | Klient HTTP |
| date-fns | Operacje na datach |
| Zustand | Stan globalny (user, token) |

### Instalacja

```bash
cd frontend
npm install @tanstack/react-query axios date-fns zustand
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label card table badge tabs dialog select toast
```

### Struktura

```
frontend/src/
├── api/              # funkcje wywołujące endpointy
│   ├── auth.ts
│   ├── curriculum.ts
│   ├── groups.ts
│   └── schedule.ts
├── components/
│   ├── ui/           # komponenty shadcn (auto-generowane)
│   ├── layout/
│   │   ├── AppShell.tsx      # sidebar + header + outlet
│   │   ├── Sidebar.tsx       # nawigacja zależna od roli
│   │   └── ProtectedRoute.tsx
│   ├── curriculum/
│   │   └── CurriculumTable.tsx  # tabela siatki jak w PDF
│   ├── schedule/
│   │   └── ScheduleCalendar.tsx # widok tygodniowy
│   └── groups/
│       └── GroupsManager.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── CurriculumPage.tsx
│   ├── SchedulePage.tsx
│   └── GroupsPage.tsx
├── store/
│   └── authStore.ts    # Zustand — user, token, role
├── hooks/
│   ├── useAuth.ts
│   └── useCurriculum.ts
└── types/
    └── index.ts        # typy zgodne z Prisma modelami
```

### Store auth (Zustand)

```typescript
// src/store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; name: string; email: string; role: string } | null
  setAuth: (tokens: { accessToken: string; refreshToken: string }, user: any) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (tokens, user) => set({ ...tokens, user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'auth' }
  )
)
```

### Axios z interceptorem

```typescript
// src/api/client.ts
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
})

// Dodaj token do każdego requesta
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Obsłuż wygaśnięty token
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
```

### Routing z ochroną ról

```typescript
// src/components/layout/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface Props {
  children: React.ReactNode
  roles?: string[]  // jeśli brak — każda rola
}

export const ProtectedRoute = ({ children, roles }: Props) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
```

```typescript
// src/App.tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/curriculum" element={
      <ProtectedRoute roles={['ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR']}>
        <CurriculumPage />
      </ProtectedRoute>
    } />
    <Route path="/schedule" element={<SchedulePage />} />
    <Route path="/groups" element={
      <ProtectedRoute roles={['ADMIN']}>
        <GroupsPage />
      </ProtectedRoute>
    } />
  </Route>
</Routes>
```

### Nawigacja zależna od roli

```typescript
// src/components/layout/Sidebar.tsx
const NAV_ITEMS = [
  { label: 'Dashboard',      path: '/dashboard', roles: ['ADMIN','INSTRUCTOR','STUDENT','DEAN_OFFICE'] },
  { label: 'Siatka godzin',  path: '/curriculum', roles: ['ADMIN','DEAN_OFFICE','INSTRUCTOR'] },
  { label: 'Plan zajęć',     path: '/schedule',   roles: ['ADMIN','INSTRUCTOR','STUDENT','DEAN_OFFICE'] },
  { label: 'Grupy',          path: '/groups',     roles: ['ADMIN'] },
]
// Filtruj po roli zalogowanego użytkownika
```

---

### Widoki — kolejność implementacji

#### 1. LoginPage (`/login`)
- Formularz: email + hasło
- POST /api/auth/login → zapisz tokeny w Zustand
- Przekieruj na /dashboard po sukcesie
- Obsłuż błąd 401 (złe dane)

#### 2. CurriculumPage (`/curriculum`) — priorytet
Tabela siatki godzin identyczna z PDF:

```
| Lp | Przedmiot | W | C | L | P | S | ECTS | Zaliczenie |
|----|-----------|---|---|---|---|---|------|------------|
| 1  | Matematyka I | 30 | 0 | 45 | 0 | 0 | 6 | Egzamin |
```

- Filtrowanie: wybór kierunku → specjalności → semestru
- Każdy wiersz to `CurriculumEntry` z API
- ADMIN może edytować godziny inline (PUT /api/curriculum/entries/:id)
- Walidacja sumy godzin na bieżąco

#### 3. SchedulePage (`/schedule`) — najbardziej efektowny
Widok tygodniowy (pon–pt, 7:00–20:00):

- Sloty co 30 minut
- Bloki zajęć kolorowane po typie (W=niebieski, C=zielony, L=pomarańczowy)
- Klik na blok → szczegóły (sala, prowadzący, grupa)
- ADMIN: drag & drop do przesunięcia zajęć
- Filtr: wybór grupy lub prowadzącego

#### 4. GroupsPage (`/groups`) — tylko ADMIN
- Lista grup z hierarchią (drzewo)
- Formularz generowania: kierunek + semestr + liczba studentów
- Podgląd propozycji przed zatwierdzeniem
- Edycja pojedynczej grupy (nazwa, rozmiar, sala)

#### 5. DashboardPage (`/dashboard`)
Karty ze statystykami zależnymi od roli:
- ADMIN: liczba grup, procent zaplanowanych godzin, konflikty
- INSTRUCTOR: moje zajęcia w tym tygodniu
- STUDENT: plan swojej grupy na dziś/tydzień

---

### Typy TypeScript — zgodne z API

```typescript
// src/types/index.ts

export type Role = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT' | 'DEAN_OFFICE'
export type StudyMode = 'FULL_TIME' | 'PART_TIME'
export type ClassType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'PROJECT' | 'SEMINAR'
export type GroupType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'PROJECT' | 'SEMINAR'
export type RoomType = 'LECTURE' | 'EXERCISE' | 'LAB' | 'COMPUTER_LAB' | 'SEMINAR' | 'SPORTS'
export type AssessmentType = 'EXAM' | 'CREDIT'
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'

export interface CurriculumEntry {
  id: string
  semester: number
  orderInSemester: number
  hoursLecture: number
  hoursExercise: number
  hoursLab: number
  hoursProject: number
  hoursSeminar: number
  ects: number
  assessmentType: AssessmentType
  subject: { id: string; name: string; code?: string }
  instructor?: { id: string; firstName: string; lastName: string; title?: string }
}

export interface ScheduleEntry {
  id: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  academicHours: number
  classType: ClassType
  academicYear: string
  semester: number
  room: { id: string; number: string; building: { name: string } }
  instructor: { id: string; firstName: string; lastName: string }
  studentGroup: { id: string; name: string }
  curriculumEntry: { subject: { name: string } }
}

export interface StudentGroup {
  id: string
  name: string
  type: GroupType
  size: number
  semester: number
  academicYear: string
  subGroups?: StudentGroup[]
}
```

### Czego NIE rób na tym etapie

- Nie implementuj drag & drop od razu — dodaj po podstawowym widoku
- Nie styluj zbyt wcześnie — najpierw działająca logika, potem wygląd
- Nie twórz osobnych stron dla CRUD sal/budynków/prowadzących — to niski priorytet
- Nie implementuj Google OAuth
