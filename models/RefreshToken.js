const mongoose = require('mongoose')

const RefreshTokenSchema = new mongoose.Schema(
  {
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

    // Track device / user-agent for audit
    userAgent: {
      type: String,
      default: '',
    },

    ip: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

// MongoDB TTL index — automatically removes expired documents
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Quick lookup by user when logging out all sessions
RefreshTokenSchema.index({ user: 1 })

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema)
