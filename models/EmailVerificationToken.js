const mongoose = require('mongoose')

const EmailVerificationTokenSchema = new mongoose.Schema(
  {
    // Stored as SHA-256 hash of the raw token emailed to the user.
    // Raw token never touches the database.
    token: {
      type: String,
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
)

// MongoDB TTL — auto-deletes expired documents
EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Fast lookup by user (used to purge previous tokens before issuing a new one)
EmailVerificationTokenSchema.index({ user: 1 })

module.exports = mongoose.model('EmailVerificationToken', EmailVerificationTokenSchema)
