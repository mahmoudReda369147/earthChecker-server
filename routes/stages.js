const express = require('express')
const { protect } = require('../middleware/auth')
const { getCycleStages, getFormByStage } = require('../controllers/stageController')

const router = express.Router()

router.use(protect)

router.get('/cycle/:cycleId',  getCycleStages)
router.get('/:stageId/form',   getFormByStage)

module.exports = router
