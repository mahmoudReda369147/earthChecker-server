const mongoose = require('mongoose')

const StageSchema = new mongoose.Schema(
  {
    cycleId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Cycle',
      required: [true, 'Cycle is required'],
    },

    formId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Form',
      required: [true, 'Form is required'],
    },

    moduleId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Module',
      required: [true, 'Module is required'],
    },

    order: {
      type:    Number,
      default: 0,
    },

    status: {
      type:    String,
      enum:    ['locked', 'available', 'submitted'],
      default: 'locked',
    },

    submissionId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Submission',
      default: null,
    },

    submittedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    submittedAt: {
      type:    Date,
      default: null,
    },

    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: [true, 'Company is required'],
    },
  },
  { timestamps: true }
)

StageSchema.index({ cycleId: 1, order: 1 })
StageSchema.index({ cycleId: 1, formId: 1 }, { unique: true })
StageSchema.index({ companyId: 1 })

module.exports = mongoose.model('Stage', StageSchema)
