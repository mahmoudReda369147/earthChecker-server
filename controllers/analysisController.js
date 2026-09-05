const Analysis   = require('../models/Analysis')
const Submission = require('../models/Submission')
const Cycle      = require('../models/Cycle')
const Agent      = require('../models/Agent')

/* ════════════════════════════════════════════════════════════
   GET /api/analyses/submission/:submissionId
   Get all analyses for a submission (access-guarded).
   ════════════════════════════════════════════════════════════ */
async function getSubmissionAnalyses(req, res) {
  try {
    const { submissionId } = req.params

    const submission = await Submission.findOne({
      _id: submissionId,
      companyId: req.user.company,
    })
      .populate('formId', 'name sections')
      .lean()

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' })
    }

    /* ── Access check ── */
    if (req.user.role !== 'ceo') {
      const roleField = req.user.role === 'supervisor' ? 'assignedSupervisor' : 'assignedWorker'
      const cycle = await Cycle.findOne({
        _id: submission.cycleId,
        [roleField]: req.user._id,
        isDeleted: false,
      }).lean()
      if (!cycle) {
        return res.status(403).json({ success: false, message: 'You do not have access to this submission' })
      }
    }

    const analyses = await Analysis.find({ submissionId })
      .populate({ path: 'agentId', select: 'name image userPrompt tolerance complianceThreshold criticalInspection' })
      .sort({ createdAt: 1 })
      .lean()

    return res.status(200).json({ success: true, data: { analyses, submission } })
  } catch (err) {
    console.error('[getSubmissionAnalyses]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   PATCH /api/analyses/:analysisId/rate
   Like or dislike an analysis → updates Agent like/dislike.
   Body: { action: 'like' | 'dislike' }
   ════════════════════════════════════════════════════════════ */
async function rateAnalysis(req, res) {
  try {
    const { analysisId } = req.params
    const { action } = req.body

    if (!['like', 'dislike'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "like" or "dislike"' })
    }

    const analysis = await Analysis.findOne({ _id: analysisId, companyId: req.user.company })
    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' })
    }

    const prevRating = analysis.userRating
    const isSameAction = prevRating === action

    // Toggle: clicking same action again removes the rating
    const newRating = isSameAction ? null : action

    // Build the Agent update — undo previous rating, apply new one
    const agentUpdate = {}
    if (prevRating === 'like')    agentUpdate.like    = (agentUpdate.like    || 0) - 1
    if (prevRating === 'dislike') agentUpdate.dislike  = (agentUpdate.dislike || 0) - 1
    if (newRating === 'like')     agentUpdate.like    = (agentUpdate.like    || 0) + 1
    if (newRating === 'dislike')  agentUpdate.dislike  = (agentUpdate.dislike || 0) + 1

    // Update analysis
    analysis.userRating = newRating
    await analysis.save()

    // Update agent counters
    const incObj = {}
    if (agentUpdate.like)    incObj.like    = agentUpdate.like
    if (agentUpdate.dislike) incObj.dislike = agentUpdate.dislike
    if (Object.keys(incObj).length > 0) {
      await Agent.findByIdAndUpdate(analysis.agentId, { $inc: incObj })
    }

    return res.status(200).json({ success: true, data: { userRating: newRating } })
  } catch (err) {
    console.error('[rateAnalysis]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   PATCH /api/analyses/:analysisId/problem-type
   Update problemType for an analysis
   Body: { problemType: string }
   ════════════════════════════════════════════════════════════ */
async function updateProblemType(req, res) {
  try {
    const { analysisId } = req.params
    const { problemType } = req.body

    const analysis = await Analysis.findOneAndUpdate(
      { _id: analysisId, companyId: req.user.company },
      { problemType, 'aiResult.problemType': problemType },
      { new: true }
    )

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' })
    }

    return res.status(200).json({ success: true, data: { analysis } })
  } catch (err) {
    console.error('[updateProblemType]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getSubmissionAnalyses, rateAnalysis, updateProblemType }
