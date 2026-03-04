require('./config/dns')       // must be first — sets DNS before any network call
require('dotenv').config()

const express      = require('express')
const helmet       = require('helmet')
const cors         = require('cors')
const cookieParser = require('cookie-parser')
const morgan       = require('morgan')
const rateLimit    = require('express-rate-limit')
const swaggerUi    = require('swagger-ui-express')

const connectDB    = require('./config/db')
const swaggerSpec  = require('./config/swagger')
const authRoutes   = require('./routes/auth')
const moduleRoutes = require('./routes/modules')
const uploadRoutes = require('./routes/upload')
const agentRoutes  = require('./routes/agents')

/* ── Connect to MongoDB ── */
connectDB()

const app = express()

/* ════════════════════════════════════════════════════════════
   SECURITY MIDDLEWARE
   ════════════════════════════════════════════════════════════ */

// Relax helmet's CSP so Swagger UI assets load correctly in dev
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  })
)

app.use(
  cors({
    origin:      process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true, // required for httpOnly cookies
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

/* ── Global rate limit: 100 requests / 15 min per IP ── */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, message: 'Too many requests — try again later' },
  })
)

/* ── Stricter limit for auth endpoints: 20 / 15 min per IP ── */
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 20,
//   standardHeaders: true,
//   legacyHeaders:   false,
//   message: { success: false, message: 'Too many auth attempts — try again in 15 minutes' },
// })

/* ════════════════════════════════════════════════════════════
   GENERAL MIDDLEWARE
   ════════════════════════════════════════════════════════════ */
app.use(express.json({ limit: '10kb' }))        // body size guard
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

/* ════════════════════════════════════════════════════════════
   SWAGGER UI  —  http://localhost:5000/api/docs
   ════════════════════════════════════════════════════════════ */
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Feedbrush API Docs',
    swaggerOptions: {
      persistAuthorization: true,  // keeps Bearer token between page refreshes
      displayRequestDuration: true,
    },
  })
)

/* ── Raw OpenAPI JSON (useful for codegen / Postman import) ── */
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

/* ════════════════════════════════════════════════════════════
   ROUTES
   ════════════════════════════════════════════════════════════ */
app.use('/api/auth',    authRoutes)
app.use('/api/modules', moduleRoutes)
app.use('/api/upload',  uploadRoutes)
app.use('/api/agents',  agentRoutes)

/* ── Health check ── */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status:  'ok',
    env:     process.env.NODE_ENV,
    ts:      new Date().toISOString(),
  })
})

/* ── 404 handler ── */
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
})

/* ── Global error handler ── */
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err)
  const status  = err.status || 500
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  res.status(status).json({ success: false, message })
})

/* ════════════════════════════════════════════════════════════
   START
   ════════════════════════════════════════════════════════════ */
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT} (${process.env.NODE_ENV})`)
  console.log(`[DOCS]   Swagger UI → http://localhost:${PORT}/api/docs`)
})
