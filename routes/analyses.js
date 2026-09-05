const express = require('express')
const { protect } = require('../middleware/auth')
const { getSubmissionAnalyses, rateAnalysis, updateProblemType } = require('../controllers/analysisController')

const router = express.Router()

router.use(protect)

router.get('/submission/:submissionId', getSubmissionAnalyses)
router.patch('/:analysisId/rate',       rateAnalysis)
router.patch('/:analysisId/problem-type', updateProblemType)

module.exports = router
