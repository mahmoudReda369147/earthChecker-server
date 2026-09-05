const mongoose = require('mongoose')

const AgentSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Agent name is required'],
      trim:      true,
      maxlength: [120, 'Name must not exceed 120 characters'],
    },

    description: {
      type:    String,
      trim:    true,
      default: '',
    },

    userPrompt: {
      type:    String,
      trim:    true,
      default: '',
    },

    tolerance: {
      type:    Number,
      default: 0,
      min:     [0,   'Tolerance cannot be negative'],
      max:     [100, 'Tolerance cannot exceed 100'],
    },

    complianceThreshold: {
      type:    Number,
      default: 80,
      min:     [0,   'Compliance threshold cannot be negative'],
      max:     [100, 'Compliance threshold cannot exceed 100'],
    },

    criticalInspection: {
      type:    Boolean,
      default: true,
    },

    /* ── Image assets ── */
    image:         { type: String, default: '' },   // main avatar / icon
    passImage:     { type: String, default: '' },   // shown on pass result
    failImage:     { type: String, default: '' },   // shown on fail result
    thinkingImage: { type: String, default: '' },   // shown while processing

    /* ── Relations ── */
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: [true, 'Company is required'],
    },

    createdBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Creator is required'],
    },

    /* ── Social ── */
    like:    { type: Number, default: 0, min: 0 },
    dislike: { type: Number, default: 0, min: 0 },

    /* ── Soft delete ── */
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null   },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

AgentSchema.index({ companyId: 1 })
AgentSchema.index({ createdBy: 1 })

module.exports = mongoose.model('Agent', AgentSchema)
