const Submission    = require('../models/Submission')
const Cycle         = require('../models/Cycle')
const Form          = require('../models/Form')
const Stage         = require('../models/Stage')
const Agent         = require('../models/Agent')
const Analysis      = require('../models/Analysis')
const { analyzeImage } = require('../utils/geminiAgent')

/* ── Helper: check user has access to cycle ── */
function hasAccess(cycle, userId, role) {
  if (role === 'ceo') return true
  const supId    = cycle.assignedSupervisor?.toString() ?? cycle.assignedSupervisor
  const workerId = cycle.assignedWorker?.toString()     ?? cycle.assignedWorker
  const uid      = userId.toString()
  return supId === uid || workerId === uid
}

/* ════════════════════════════════════════════════════════════
   POST /api/submissions
   Submit a form stage within a cycle.
   ════════════════════════════════════════════════════════════ */
async function submitForm(req, res) {
  try {
    const { cycleId, formId, answers = [] } = req.body

    if (!cycleId || !formId) {
      return res.status(400).json({ success: false, message: 'cycleId and formId are required' })
    }

    /* ── Load cycle ── */
    const cycle = await Cycle.findOne({ _id: cycleId, companyId: req.user.company, isDeleted: false })
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' })

    /* ── Access check ── */
    if (!hasAccess(cycle, req.user._id, req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this cycle' })
    }

    /* ── Status check ── */
    if (!['new', 'inProgress'].includes(cycle.status)) {
      return res.status(400).json({ success: false, message: 'Submissions are only allowed when cycle is new or inProgress' })
    }

    /* ── Load form & verify it belongs to cycle's module ── */
    const form = await Form.findOne({ _id: formId, moduleId: cycle.moduleId, isDeleted: false })
    if (!form) return res.status(404).json({ success: false, message: 'Form not found in this module' })

    /* ── Find the stage record ── */
    const stage = await Stage.findOne({ cycleId, formId })
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found for this form' })
    }

    if (stage.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'This stage has already been submitted' })
    }

    if (stage.status === 'locked') {
      return res.status(400).json({ success: false, message: 'Previous stages must be submitted first' })
    }

    /* ── Create submission ── */
    const submission = await Submission.create({
      cycleId,
      formId,
      moduleId:    cycle.moduleId,
      submittedBy: req.user._id,
      companyId:   req.user.company,
      answers,
    })

    /* ── Update current stage ── */
    stage.status       = 'submitted'
    stage.submissionId = submission._id
    stage.submittedBy  = req.user._id
    stage.submittedAt  = new Date()
    await stage.save()

    /* ── Unlock next stage ── */
    const nextStage = await Stage.findOne({ cycleId, order: { $gt: stage.order }, status: 'locked' }).sort({ order: 1 })
    if (nextStage) {
      nextStage.status = 'available'
      await nextStage.save()
    }

    /* ── Update cycle status & progress ── */
    const totalStages     = await Stage.countDocuments({ cycleId })
    const submittedStages = await Stage.countDocuments({ cycleId, status: 'submitted' })
    const progress        = Math.round((submittedStages / totalStages) * 100)

    const statusUpdate = {}
    if (cycle.status === 'new') statusUpdate.status = 'inProgress'
    if (progress >= 100)        statusUpdate.status = 'completed'
    statusUpdate.progress = progress

    await Cycle.findByIdAndUpdate(cycleId, statusUpdate)

    /* ── AI analysis for image fields with assigned agents ── */
    const imageAnswers = answers.filter(
      (a) => a.fieldType === 'image' && a.assignedAgent && a.value
    )
   console.log(imageAnswers,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    const analyses = []
    for (const answer of imageAnswers) {
      try {
        console.log(answer,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
        const agent = await Agent.findById(answer.assignedAgent)
        if (!agent || !agent.userPrompt) continue

        const urls = Array.isArray(answer.value) ? answer.value : [answer.value]
        if (urls.length === 0) continue
        console.log(urls,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
        const aiResult = await analyzeImage(urls, {
          prompt:    agent.userPrompt,
          tolerance: agent.tolerance ?? 70,
        })
        console.log(aiResult,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')

        const analysis = await Analysis.create({
          submissionId: submission._id,
          agentId:      agent._id,
          fieldId:      answer.fieldId,
          imageUrls:    urls,
          aiResult,
          companyId:    req.user.company,
        })
        analyses.push(analysis)
      } catch (aiErr) {
        console.error('[AI analysis error]', aiErr.message)
      }
    }

    await submission.populate([
      { path: 'submittedBy', select: 'name' },
      { path: 'formId',      select: 'name order' },
    ])

    return res.status(201).json({ success: true, data: { submission, analyses } })
  } catch (err) {
    console.error('[submitForm]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   GET /api/submissions/cycle/:cycleId
   Get all submissions for a cycle (access-guarded).
   ════════════════════════════════════════════════════════════ */
async function getCycleSubmissions(req, res) {
  try {
    const { cycleId } = req.params

    const cycle = await Cycle.findOne({ _id: cycleId, companyId: req.user.company, isDeleted: false })
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' })

    if (!hasAccess(cycle, req.user._id, req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this cycle' })
    }

    const submissions = await Submission.find({ cycleId })
      .populate({ path: 'formId',      select: 'name order' })
      .populate({ path: 'submittedBy', select: 'name image' })
      .sort({ createdAt: 1 })
      .lean()

    return res.status(200).json({ success: true, data: { submissions } })
  } catch (err) {
    console.error('[getCycleSubmissions]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   GET /api/submissions
   CEO  → all submissions in company
   Supervisor → submissions on cycles where they are assignedSupervisor
   Worker → submissions on cycles where they are assignedWorker
   ════════════════════════════════════════════════════════════ */
async function getSubmissions(req, res) {
  try {
    const {
      page      = 1,
      limit     = 10,
      search    = '',
      moduleId  = '',
      cycleId   = '',
      sortBy    = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    const pageNum  = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))
    const skip     = (pageNum - 1) * limitNum

    const filter = { companyId: req.user.company }

    /* ── Role scoping ── */
    if (req.user.role === 'supervisor' || req.user.role === 'worker') {
      const roleField = req.user.role === 'supervisor' ? 'assignedSupervisor' : 'assignedWorker'
      const myCycles = await Cycle.find(
        { companyId: req.user.company, isDeleted: false, [roleField]: req.user._id },
        '_id'
      ).lean()
      const cycleIds = myCycles.map((c) => c._id)
      filter.cycleId = { $in: cycleIds }
    }

    if (moduleId.trim()) filter.moduleId = moduleId.trim()
    if (cycleId.trim())  filter.cycleId  = cycleId.trim()

    if (search.trim()) {
      const formMatches = await Form.find(
        { companyId: req.user.company, isDeleted: false, name: { $regex: search.trim(), $options: 'i' } },
        '_id'
      ).lean()
      filter.formId = { $in: formMatches.map((f) => f._id) }
    }

    const ALLOWED_SORT = ['createdAt', 'updatedAt']
    const sortField    = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir      = sortOrder === 'asc' ? 1 : -1

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .populate({ path: 'formId',      select: 'name order' })
        .populate({ path: 'moduleId',    select: 'name title' })
        .populate({ path: 'cycleId',     select: 'name cycleId status' })
        .populate({ path: 'submittedBy', select: 'name email image' })
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Submission.countDocuments(filter),
    ])

    return res.status(200).json({
      success: true,
      data: {
        submissions,
        pagination: {
          total,
          totalPages: Math.ceil(total / limitNum),
          page:       pageNum,
          limit:      limitNum,
          hasNext:    pageNum < Math.ceil(total / limitNum),
          hasPrev:    pageNum > 1,
        },
      },
    })
  } catch (err) {
    console.error('[getSubmissions]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


module.exports = { submitForm, getCycleSubmissions, getSubmissions }
