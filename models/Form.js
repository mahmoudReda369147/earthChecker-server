const mongoose = require('mongoose')

/* ── Section.setting (embedded, no _id needed) ── */
const SectionSettingSchema = new mongoose.Schema(
  {
    max:      { type: Number, default: null },
    min:      { type: Number, default: null },
    length:   { type: Number, default: null },
    size:     { type: Number, default: null },
    sizeMode: { type: String, enum: ['sampleSizeBased', 'customSize'], default: 'sampleSizeBased' },
    unitCost: { type: Number, default: 0 },
  },
  { _id: false }
)

/* ── Single section inside a form ── */
const SectionSchema = new mongoose.Schema(
  {
    type: {
      type:    String,
      trim:    true,
      default: '',
    },

    title: {
      type:      String,
      trim:      true,
      maxlength: [200, 'Section title must not exceed 200 characters'],
      default:   '',
    },

    descriptions: {
      type:    String,
      trim:    true,
      default: '',
    },

    options: {
      type:    [String],
      default: [],
    },

    assignedBotId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Agent',
      default: null,
    },

    isRequired: {
      type:    Boolean,
      default: false,
    },

    setting: {
      type:    SectionSettingSchema,
      default: () => ({}),
    },
  },
  { _id: true }
)

/* ── Form document ── */
const FormSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Form name is required'],
      trim:      true,
      maxlength: [120, 'Name must not exceed 120 characters'],
    },

    description: {
      type:    String,
      trim:    true,
      default: '',
    },

    createdBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Creator is required'],
    },

    moduleId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Module',
      required: [true, 'Module is required'],
    },

    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: [true, 'Company is required'],
    },

    sections: {
      type:    [SectionSchema],
      default: [],
    },

    /* ── Display order (used by reorder endpoint) ── */
    order: { type: Number, default: 0 },

    /* ── Soft delete ── */
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null   },
    deletedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
  },
  { timestamps: true }
)

/* Fast lookups */
FormSchema.index({ companyId: 1 })
FormSchema.index({ moduleId:  1 })
FormSchema.index({ createdBy: 1 })

module.exports = mongoose.model('Form', FormSchema)
