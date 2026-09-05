const express = require('express')
const router  = express.Router()
const { protect, authorize } = require('../middleware/auth')
const {
  getSettings,
  updateSettings,
  rotateApiKey,
} = require('../controllers/settingsController')

/* All settings routes require authentication and CEO role */
router.use(protect)
router.use(authorize('ceo'))

router.route('/')
  .get(getSettings)
  .put(updateSettings)

router.post('/rotate-api-key', rotateApiKey)

module.exports = router
