const mongoose = require('mongoose')

const ModuleSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Module title is required'],
      trim:      true,
      maxlength: [120, 'Title must not exceed 120 characters'],
    },

    description: {
      type:    String,
      trim:    true,
      default: '',
    },

    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: [true, 'Company is required'],
    },

    creatorId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Creator is required'],
    },

    image: {
      type:    String,   // URL or file path
      default: '',
    },

    /* ── Soft delete ── */
    isDeleted: {
      type:    Boolean,
      default: false,
    },

    deletedAt: {
      type:    Date,
      default: null,
    },

    deletedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
  },
  { timestamps: true }
)

/* Fast lookups: all modules for a company, or by creator */
ModuleSchema.index({ companyId: 1 })
ModuleSchema.index({ creatorId: 1 })

module.exports = mongoose.model('Module', ModuleSchema)
