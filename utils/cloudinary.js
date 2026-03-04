const { v2: cloudinary } = require('cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a buffer directly to Cloudinary.
 * @param {Buffer} buffer
 * @param {object} options  — any cloudinary upload options (folder, public_id, etc.)
 * @returns {Promise<object>} Cloudinary upload result (result.secure_url is the image URL)
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:       options.folder       ?? 'uploads',
        public_id:    options.public_id    ?? undefined,
        fetch_format: 'auto',
        quality:      'auto',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      }
    )
    stream.end(buffer)
  })
}

module.exports = { cloudinary, uploadBuffer }
