const express  = require('express')
const multer   = require('multer')
const { protect, authorize } = require('../middleware/auth')
const {
  createAgent, getAgents, getAgent, updateAgent, deleteAgent,
  likeAgent, dislikeAgent,
} = require('../controllers/agentController')

const router = express.Router()

/* Multer: memory storage, max 5 MB per file, up to 4 image fields */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported type: ${file.mimetype}`))
  },
}).fields([
  { name: 'image',         maxCount: 1 },
  { name: 'passImage',     maxCount: 1 },
  { name: 'failImage',     maxCount: 1 },
  { name: 'thinkingImage', maxCount: 1 },
])

/* ── CEO-only CRUD ── */
router.route('/')
  .get(protect, authorize('ceo'), getAgents)
  .post(protect, authorize('ceo'), upload, createAgent)

router.route('/:id')
  .get(protect,    authorize('ceo'), getAgent)
  .patch(protect,  authorize('ceo'), upload, updateAgent)
  .delete(protect, authorize('ceo'), deleteAgent)

/* ── Like / dislike — any authenticated user ── */
router.patch('/:id/like',    protect, likeAgent)
router.patch('/:id/dislike', protect, dislikeAgent)

module.exports = router
