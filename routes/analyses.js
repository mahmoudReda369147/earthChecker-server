const express = require('express')
const { protect } = require('../middleware/auth')
const { getSubmissionAnalyses, rateAnalysis } = require('../controllers/analysisController')

const router = express.Router()

router.use(protect)

router.get('/submission/:submissionId', getSubmissionAnalyses)
router.patch('/:analysisId/rate',       rateAnalysis)

module.exports = router
