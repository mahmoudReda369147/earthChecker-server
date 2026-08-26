const express = require('express')
const { protect } = require('../middleware/auth')
const { submitForm, getCycleSubmissions, getSubmissions } = require('../controllers/submissionController')

const router = express.Router()

router.use(protect)

router.get('/',                      getSubmissions)
router.post('/',                    submitForm)
router.get('/cycle/:cycleId',       getCycleSubmissions)

module.exports = router
