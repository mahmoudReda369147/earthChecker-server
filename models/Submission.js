const mongoose = require('mongoose')

const AnswerSchema = new mongoose.Schema(
  {
    fieldId:       { type: mongoose.Schema.Types.ObjectId },
    fieldLabel:    { type: String, default: '' },
    fieldType:     { type: String, default: '' },
    value:         { type: mongoose.Schema.Types.Mixed, default: '' },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { _id: false }
)

const SubmissionSchema = new mongoose.Schema(
  {
    cycleId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle',   required: true },
    formId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Form',    required: true },
    moduleId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Module',  required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    answers:     { type: [AnswerSchema], default: [] },
    complianceStatus: {
      type:    String,
      enum:    ['compliance', 'not compliance'],
      default: 'compliance',
    },
    status: {
      type:    String,
      default: 'compliance',
    },
    scrap: {
      type:    Number,
      default: 0,
    },
    scrapCost: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }
)

SubmissionSchema.index({ cycleId: 1 })
SubmissionSchema.index({ formId:  1 })
SubmissionSchema.index({ companyId: 1 })

module.exports = mongoose.model('Submission', SubmissionSchema)
