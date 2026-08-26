const mongoose = require('mongoose')

const AnalysisSchema = new mongoose.Schema(
  {
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
    agentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Agent',      required: true },
    fieldId:      { type: mongoose.Schema.Types.ObjectId, required: true },
    imageUrls:    { type: [String], default: [] },
    aiResult: {
      result:     { type: String, enum: ['pass', 'fail'], required: true },
      reason:     { type: String, default: null },
      confidence: { type: Number, min: 0, max: 100, default: 0 },
    },
    userRating: { type: String, enum: ['like', 'dislike', null], default: null },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
)

AnalysisSchema.index({ submissionId: 1 })
AnalysisSchema.index({ agentId: 1 })
AnalysisSchema.index({ companyId: 1 })

module.exports = mongoose.model('Analysis', AnalysisSchema)
