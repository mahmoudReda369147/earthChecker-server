const express = require('express')
const { protect }                          = require('../middleware/auth')
const { uploadImage, handleUploadError }   = require('../controllers/uploadController')

const router = express.Router()

// POST /api/upload/image  — any authenticated user
router.post('/image', protect, uploadImage, handleUploadError)

module.exports = router
