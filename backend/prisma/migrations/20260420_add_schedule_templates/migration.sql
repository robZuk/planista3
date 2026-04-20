-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'MAKEUP');

-- CreateEnum
CREATE TYPE "SemesterType" AS ENUM ('WINTER', 'SUMMER');

-- AlterTable
ALTER TABLE "ScheduleEntry" DROP COLUMN "academicYear",
DROP COLUMN "dayOfWeek",
DROP COLUMN "semester",
DROP COLUMN "weekType",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT now(),
ADD COLUMN     "status" "EntryStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "templateId" TEXT;

-- Remove the default after the column is added (to enforce NOT NULL going forward)
ALTER TABLE "ScheduleEntry" ALTER COLUMN "date" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ScheduleTemplate" (
    "id" TEXT NOT NULL,
    "curriculumEntryId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "academicHours" INTEGER NOT NULL,
    "classType" "ClassType" NOT NULL,
    "weekType" "WeekType" NOT NULL DEFAULT 'EVERY',
    "studyMode" "StudyMode" NOT NULL DEFAULT 'FULL_TIME',
    "roomId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "studentGroupId" TEXT,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterCalendar" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semesterType" "SemesterType" NOT NULL,
    "studyMode" "StudyMode" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "teachingWeeks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemesterCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SemesterCalendar_academicYear_semesterType_studyMode_key" ON "SemesterCalendar"("academicYear", "semesterType", "studyMode");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_date_key" ON "PublicHoliday"("date");

-- AddForeignKey
ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_curriculumEntryId_fkey" FOREIGN KEY ("curriculumEntryId") REFERENCES "CurriculumEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_studentGroupId_fkey" FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScheduleTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
