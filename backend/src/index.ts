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
import scheduleRoutes from './routes/schedule'
import groupRoutes from './routes/groups'

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors())
app.use(express.json())

app.use('/api/faculties', facultyRoutes)
app.use('/api/fields-of-study', fieldOfStudyRoutes)
app.use('/api/specializations', specializationRoutes)
app.use('/api/buildings', buildingRoutes)
app.use('/api/instructors', instructorRoutes)
app.use('/api/curriculum', curriculumRoutes)
app.use('/api/subjects', subjectRoutes)

app.use('/api/schedule', scheduleRoutes)
app.use('/api/groups', groupRoutes)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
