const multer       = require('multer')
const { uploadBuffer } = require('../utils/cloudinary')

/* ── Multer: store file in memory (no disk writes) ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024, files: 1 },   // 5 MB
  fileFilter: (_req, file, cb) => {
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    if (ALLOWED.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`Unsupported type: ${file.mimetype}`))
  },
})

/* ════════════════════════════════════════════════════════════
   POST /api/upload/image
   Body:  multipart/form-data field "image"
   Returns: { success, data: { url, publicId, width, height } }
   ════════════════════════════════════════════════════════════ */
const uploadImage = [
  upload.single('image'),

  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    try {
      const folder = req.query.folder || 'uploads'
      const result = await uploadBuffer(req.file.buffer, { folder })

      return res.status(200).json({
        success: true,
        data: {
          url:      result.secure_url,
          publicId: result.public_id,
          width:    result.width,
          height:   result.height,
          format:   result.format,
        },
      })
    } catch (err) {
      console.error('[uploadImage]', err)
      return res.status(500).json({ success: false, message: err.message || 'Upload to Cloudinary failed' })
    }
  },
]

/* ── Multer error handler (size, type) ── */
function handleUploadError(err, _req, res, _next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large. Maximum is 5 MB.' })
  }
  return res.status(400).json({ success: false, message: err.message || 'Upload error' })
}

module.exports = { uploadImage, handleUploadError }
