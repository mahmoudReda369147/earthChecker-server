const express = require('express')
const { protect } = require('../middleware/auth')
const { getOverviewStats } = require('../controllers/overviewController')

const router = express.Router()

router.use(protect)

router.get('/', getOverviewStats)

module.exports = router
