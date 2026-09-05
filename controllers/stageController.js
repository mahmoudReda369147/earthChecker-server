const Stage = require('../models/Stage')
const Cycle = require('../models/Cycle')

const POPULATE = [
  { path: 'formId',      select: 'name description order sections' },
  { path: 'submittedBy', select: 'name image' },
  { path: 'submissionId' },
]

/* ── Helper: check user has access to cycle ── */
function hasAccess(cycle, userId, role) {
  if (role === 'ceo') return true
  const supId    = cycle.assignedSupervisor?.toString() ?? cycle.assignedSupervisor
  const workerId = cycle.assignedWorker?.toString()     ?? cycle.assignedWorker
  const uid      = userId.toString()
  return supId === uid || workerId === uid
}

/* ════════════════════════════════════════════════════════════
   GET /api/stages/cycle/:cycleId
   Get all stages for a cycle (access-guarded).
   ════════════════════════════════════════════════════════════ */
async function getCycleStages(req, res) {
  try {
    const { cycleId } = req.params

    const cycle = await Cycle.findOne({ _id: cycleId, companyId: req.user.company, isDeleted: false })
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' })

    if (!hasAccess(cycle, req.user._id, req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this cycle' })
    }

    const stages = await Stage.find({ cycleId })
      .populate(POPULATE)
      .sort({ order: 1 })
      .lean()

    return res.status(200).json({ success: true, data: { stages } })
  } catch (err) {
    console.error('[getCycleStages]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/stages/:stageId/form
   Returns form data ONLY if stage status is "available".
   ════════════════════════════════════════════════════════════ */
async function getFormByStage(req, res) {
  try {
    const stage = await Stage.findById(req.params.stageId)
      .populate({ path: 'formId', select: 'name description order sections' })

    if (!stage) return res.status(404).json({ success: false, message: 'Stage not found' })

    /* Access check */
    const cycle = await Cycle.findOne({ _id: stage.cycleId, companyId: req.user.company, isDeleted: false })
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' })

    if (!hasAccess(cycle, req.user._id, req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this cycle' })
    }

    /* Status check */
    if (stage.status !== 'available') {
      return res.status(403).json({ success: false, message: stage.status === 'submitted' ? 'This stage has already been submitted' : 'This stage is locked' })
    }

    /* Cycle status check */
    if (!['new', 'inProgress'].includes(cycle.status)) {
      return res.status(403).json({ success: false, message: 'Submissions are disabled for this cycle' })
    }

    return res.status(200).json({
      success: true,
      data: {
        stage: {
          _id:     stage._id,
          status:  stage.status,
          order:   stage.order,
          formId:  stage.formId,
          cycleId: stage.cycleId,
        },
        cycle: {
          _id:            cycle._id,
          name:           cycle.name,
          status:         cycle.status,
          sampleSize:     cycle.sampleSize,
          totalBatchSize: cycle.totalBatchSize,
          unitCost:       cycle.unitCost,
        },
      },
    })
  } catch (err) {
    console.error('[getFormByStage]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getCycleStages, getFormByStage }
