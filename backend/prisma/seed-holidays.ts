import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const HOLIDAYS: { date: string; name: string }[] = [
  // Semestr zimowy 2024/2025
  { date: '2024-11-01', name: 'Wszystkich Świętych' },
  { date: '2024-11-11', name: 'Narodowe Święto Niepodległości' },
  { date: '2024-12-25', name: 'Boże Narodzenie' },
  { date: '2024-12-26', name: 'Drugi Dzień Bożego Narodzenia' },
  // Semestr letni 2024/2025
  { date: '2025-01-01', name: 'Nowy Rok' },
  { date: '2025-01-06', name: 'Święto Trzech Króli' },
  { date: '2025-04-20', name: 'Niedziela Wielkanocna' },
  { date: '2025-04-21', name: 'Poniedziałek Wielkanocny' },
  { date: '2025-05-01', name: 'Święto Pracy' },
  { date: '2025-05-03', name: 'Święto Konstytucji 3 Maja' },
  { date: '2025-06-08', name: 'Zesłanie Ducha Świętego' },
  { date: '2025-06-19', name: 'Boże Ciało' },
  { date: '2025-08-15', name: 'Wniebowzięcie NMP / Święto Wojska Polskiego' },
]

async function main() {
  console.log('Seeding holidays...')
  for (const h of HOLIDAYS) {
    await prisma.publicHoliday.upsert({
      where: { date: new Date(h.date) },
      update: { name: h.name },
      create: { date: new Date(h.date), name: h.name },
    })
    console.log(`  ${h.date}  ${h.name}`)
  }
  console.log(`Done — upserted ${HOLIDAYS.length} holidays.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
