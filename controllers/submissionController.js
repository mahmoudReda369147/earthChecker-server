const mongoose      = require('mongoose')
const Submission    = require('../models/Submission')
const Cycle         = require('../models/Cycle')
const Form          = require('../models/Form')
const Stage         = require('../models/Stage')
const Module        = require('../models/Module')
const Agent         = require('../models/Agent')
const Analysis      = require('../models/Analysis')
const User          = require('../models/User')
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

    /* ── Validate image count requirements ── */
    const formSections = form.sections || []
    for (const section of formSections) {
      if (section.type === 'image') {
        const isCustomSize = section.setting?.sizeMode === 'customSize'
        const reqCount = isCustomSize
          ? (Number(section.setting?.size) || 1)
          : (Number(cycle.sampleSize) || 1)

        const ansObj = (answers || []).find(
          (a) => a.fieldId?.toString() === section._id?.toString()
        )
        const urls = ansObj && ansObj.value
          ? (Array.isArray(ansObj.value) ? ansObj.value.filter(Boolean) : [ansObj.value])
          : []

        if (urls.length !== reqCount) {
          return res.status(400).json({
            success: false,
            message: `Image section "${section.title || 'Untitled'}" requires exactly ${reqCount} image(s) (${isCustomSize ? 'Custom size' : 'Sample size based'}), but ${urls.length} uploaded.`,
          })
        }
      }
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
    let nextStage = await Stage.findOne({ cycleId, order: { $gt: stage.order }, status: 'locked' }).sort({ order: 1 })
    if (!nextStage) {
      // Fallback: if orders were identical, unlock the next locked stage
      nextStage = await Stage.findOne({ cycleId, status: 'locked', _id: { $ne: stage._id } }).sort({ order: 1, createdAt: 1 })
    }
    if (nextStage) {
      nextStage.status = 'available'
      await nextStage.save()
    }

    /* ── Calculate cycle progress ── */
    const totalStages     = await Stage.countDocuments({ cycleId })
    const submittedStages = await Stage.countDocuments({ cycleId, status: 'submitted' })
    const progress        = Math.round((submittedStages / totalStages) * 100)

    /* ── AI analysis for image fields with assigned agents ── */
    const imageAnswers = answers.filter(
      (a) => a.fieldType === 'image' && a.assignedAgent && a.value
    )

    const moduleDoc = await Module.findById(cycle.moduleId)
    const moduleProblemTypes = moduleDoc?.problemTypes ?? []

    const analyses = []
    for (const answer of imageAnswers) {
      try {
        const agent = await Agent.findById(answer.assignedAgent)
        if (!agent || !agent.userPrompt) continue

        const urls = Array.isArray(answer.value)
          ? answer.value.filter(Boolean)
          : (answer.value ? [answer.value] : [])

        if (urls.length === 0) continue

        /* Process each image individually */
        for (const singleUrl of urls) {
          try {
            let aiResult
            try {
              aiResult = await analyzeImage([singleUrl], {
                prompt:       agent.userPrompt,
                tolerance:    agent.tolerance ?? 70,
                problemTypes: moduleProblemTypes,
              })
            } catch (aiErr) {
              console.error('[AI analysis execution error]', aiErr)
              aiResult = {
                result:      'fail',
                reason:      `AI inspection requirement evaluation failed: ${aiErr.message || 'Image requires manual verification'}`,
                confidence:  70,
                problemType: moduleProblemTypes[0] || 'Quality Inspection Defect',
              }
            }

            const analysis = await Analysis.create({
              submissionId: submission._id,
              agentId:      agent._id,
              fieldId:      answer.fieldId,
              imageUrls:    [singleUrl],
              aiResult,
              problemType:  aiResult.problemType,
              companyId:    req.user.company,
            })
            analyses.push(analysis)
          } catch (singleErr) {
            console.error('[Individual image AI analysis error]', singleErr)
          }
        }
      } catch (aiErr) {
        console.error('[AI analysis persistence error]', aiErr.message)
      }
    }

    /* ── Calculate & store Compliance Status on Submission document ── */
    const fieldAnalysesMap = {}
    for (const a of analyses) {
      const fId = a.fieldId ? a.fieldId.toString() : (a.agentId?._id?.toString() || 'default')
      if (!fieldAnalysesMap[fId]) fieldAnalysesMap[fId] = []
      fieldAnalysesMap[fId].push(a)
    }

    let isCompliant = true
    for (const fId of Object.keys(fieldAnalysesMap)) {
      const fieldAnalyses = fieldAnalysesMap[fId]
      if (fieldAnalyses.length === 0) continue

      const agent = fieldAnalyses[0]?.agentId
      const isCritical = agent ? (agent.criticalInspection !== false) : true
      if (!isCritical) continue

      const passCount = fieldAnalyses.filter((a) => a.aiResult?.result === 'pass').length
      const passPercentage = (passCount / fieldAnalyses.length) * 100
      const threshold = (agent && agent.complianceThreshold != null) ? Number(agent.complianceThreshold) : 80

      if (passPercentage < threshold) {
        isCompliant = false
        break
      }
    }

    /* ── Calculate Scrap for all AI Image sections ── */
    let totalProjectedScrap = 0
    let totalScrapCost      = 0

    for (const section of formSections) {
      if (section.type !== 'image') continue

      const sectionAnalyses = analyses.filter(
        (a) => a.fieldId && a.fieldId.toString() === section._id?.toString()
      )

      const failedCount = sectionAnalyses.filter(
        (a) => a.aiResult?.result === 'fail'
      ).length

      const sizeMode = section.setting?.sizeMode || 'sampleSizeBased'
      const unitCost = Number(section.setting?.unitCost) || 0

      let sectionScrap = 0
      let sectionScrapCost = 0

      if (sizeMode === 'customSize') {
        sectionScrap = failedCount
        sectionScrapCost = failedCount * unitCost
      } else {
        const sampleSize = Number(cycle.sampleSize) || sectionAnalyses.length || 1
        const totalBatchSize = Number(cycle.totalBatchSize) || 0
        const defectRate = sampleSize > 0 ? (failedCount / sampleSize) : 0

        sectionScrap = defectRate * totalBatchSize
        sectionScrapCost = sectionScrap * unitCost
      }

      totalProjectedScrap += sectionScrap
      totalScrapCost += sectionScrapCost
    }

    const subComplianceStatus = isCompliant ? 'compliance' : 'not compliance'
    submission.complianceStatus = subComplianceStatus
    submission.status = subComplianceStatus
    submission.scrap = Math.round(totalProjectedScrap * 100) / 100
    submission.scrapCost = Math.round(totalScrapCost * 100) / 100
    await submission.save()

    /* ── Update Cycle status & complianceStatus (accepted / rejected) on last submission ── */
    const cycleUpdate = { progress }
    if (cycle.status === 'new') cycleUpdate.status = 'inProgress'

    if (submittedStages >= totalStages || progress >= 100) {
      cycleUpdate.status = 'completed'
      const cycleSubmissions = await Submission.find({ cycleId })
      const allCompliant =
        cycleSubmissions.length > 0 &&
        cycleSubmissions.every(
          (s) => s.complianceStatus === 'compliance' || s.status === 'compliance'
        )

      cycleUpdate.complianceStatus = allCompliant ? 'accepted' : 'rejected'
    }

    await Cycle.findByIdAndUpdate(cycleId, cycleUpdate)

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

// Background sync for existing legacy submissions & cycles stored in DB
setTimeout(() => {
  Submission.find({}).then(async (subs) => {
    for (const sub of subs) {
      // Ensure existing submission compliance status is saved
      const analyses = await Analysis.find({ submissionId: sub._id }).populate({ path: 'agentId', select: 'complianceThreshold criticalInspection name' }).lean()
      if (!analyses || analyses.length === 0) continue

      const fieldAnalysesMap = {}
      for (const a of analyses) {
        const fId = a.fieldId ? a.fieldId.toString() : (a.agentId?._id?.toString() || 'default')
        if (!fieldAnalysesMap[fId]) fieldAnalysesMap[fId] = []
        fieldAnalysesMap[fId].push(a)
      }

      let isCompliant = true
      for (const fId of Object.keys(fieldAnalysesMap)) {
        const fieldAnalyses = fieldAnalysesMap[fId]
        if (fieldAnalyses.length === 0) continue

        const agent = fieldAnalyses[0]?.agentId
        const isCritical = agent ? (agent.criticalInspection !== false) : true
        if (!isCritical) continue

        const passCount = fieldAnalyses.filter((a) => a.aiResult?.result === 'pass').length
        const passPercentage = (passCount / fieldAnalyses.length) * 100
        const threshold = (agent && agent.complianceThreshold != null) ? Number(agent.complianceThreshold) : 80

        if (passPercentage < threshold) {
          isCompliant = false
          break
        }
      }

      /* Scrap calculation sync */
      const [form, cycle] = await Promise.all([
        Form.findById(sub.formId).lean(),
        Cycle.findById(sub.cycleId).lean(),
      ])

      let totalProjectedScrap = 0
      let totalScrapCost      = 0

      if (form && form.sections && cycle) {
        for (const section of form.sections) {
          if (section.type !== 'image') continue

          const sectionAnalyses = analyses.filter(
            (a) => a.fieldId && a.fieldId.toString() === section._id?.toString()
          )

          const failedCount = sectionAnalyses.filter(
            (a) => a.aiResult?.result === 'fail'
          ).length

          const sizeMode = section.setting?.sizeMode || 'sampleSizeBased'
          const unitCost = Number(section.setting?.unitCost) || 0

          let sectionScrap = 0
          let sectionScrapCost = 0

          if (sizeMode === 'customSize') {
            sectionScrap = failedCount
            sectionScrapCost = failedCount * unitCost
          } else {
            const sampleSize = Number(cycle.sampleSize) || sectionAnalyses.length || 1
            const totalBatchSize = Number(cycle.totalBatchSize) || 0
            const defectRate = sampleSize > 0 ? (failedCount / sampleSize) : 0

            sectionScrap = defectRate * totalBatchSize
            sectionScrapCost = sectionScrap * unitCost
          }

          totalProjectedScrap += sectionScrap
          totalScrapCost += sectionScrapCost
        }
      }

      const finalStatus = isCompliant ? 'compliance' : 'not compliance'
      sub.complianceStatus = finalStatus
      sub.status = finalStatus
      sub.scrap = Math.round(totalProjectedScrap * 100) / 100
      sub.scrapCost = Math.round(totalScrapCost * 100) / 100
      await sub.save()
    }

    const cycles = await Cycle.find({})
    for (const cycle of cycles) {
      const totalStages     = await Stage.countDocuments({ cycleId: cycle._id })
      const submittedStages = await Stage.countDocuments({ cycleId: cycle._id, status: 'submitted' })
      if (totalStages > 0 && submittedStages >= totalStages) {
        const cycleSubmissions = await Submission.find({ cycleId: cycle._id })
        const allCompliant =
          cycleSubmissions.length > 0 &&
          cycleSubmissions.every(
            (s) => s.complianceStatus === 'compliance' || s.status === 'compliance'
          )

        const finalComplianceStatus = allCompliant ? 'accepted' : 'rejected'
        if (cycle.complianceStatus !== finalComplianceStatus) {
          cycle.complianceStatus = finalComplianceStatus
          cycle.status = 'completed'
          cycle.progress = 100
          await cycle.save()
        }
      }
    }
  }).catch((err) => console.error('[Submission/Cycle DB sync error]', err.message))
}, 2000)


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

    const submissionIds = submissions.map((s) => s._id)
    const analyses = await Analysis.find({ submissionId: { $in: submissionIds } })
      .populate({ path: 'agentId', select: 'name image userPrompt tolerance' })
      .sort({ createdAt: 1 })
      .lean()

    return res.status(200).json({ success: true, data: { submissions, analyses } })
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
      page         = 1,
      limit        = 10,
      search       = '',
      moduleId     = '',
      cycleId      = '',
      status       = '',
      submittedBy  = '',
      fromDate     = '',
      toDate       = '',
      sortBy       = 'createdAt',
      sortOrder    = 'desc',
    } = req.query

    const pageNum  = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))
    const skip     = (pageNum - 1) * limitNum

    const filter = { companyId: req.user.company }

    /* ── Date Range Filter ── */
    if (fromDate || toDate) {
      filter.createdAt = {}
      if (fromDate) {
        const from = new Date(fromDate)
        if (!isNaN(from.getTime())) {
          from.setHours(0, 0, 0, 0)
          filter.createdAt.$gte = from
        }
      }
      if (toDate) {
        const to = new Date(toDate)
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999)
          filter.createdAt.$lte = to
        }
      }
    }

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

    /* ── 1. Module Filter ── */
    if (moduleId && moduleId.trim()) {
      const mVal = moduleId.trim()
      if (mongoose.Types.ObjectId.isValid(mVal)) {
        filter.moduleId = mVal
      } else {
        const moduleMatches = await Module.find(
          {
            companyId: req.user.company,
            isDeleted: false,
            $or: [
              { title: { $regex: mVal, $options: 'i' } },
              { name: { $regex: mVal, $options: 'i' } },
            ],
          },
          '_id'
        ).lean()
        filter.moduleId = { $in: moduleMatches.map((m) => m._id) }
      }
    }

    /* ── 2. Cycle Filter ── */
    if (cycleId && cycleId.trim()) {
      const cVal = cycleId.trim()
      if (mongoose.Types.ObjectId.isValid(cVal)) {
        if (filter.cycleId && filter.cycleId.$in) {
          const allowedStr = new Set(filter.cycleId.$in.map((id) => id.toString()))
          if (allowedStr.has(cVal)) {
            filter.cycleId = cVal
          } else {
            filter.cycleId = { $in: [] }
          }
        } else {
          filter.cycleId = cVal
        }
      } else {
        const cycleMatches = await Cycle.find(
          {
            companyId: req.user.company,
            isDeleted: false,
            $or: [
              { name: { $regex: cVal, $options: 'i' } },
              { cycleId: { $regex: cVal, $options: 'i' } },
            ],
          },
          '_id'
        ).lean()
        const matchedIds = cycleMatches.map((c) => c._id)
        if (filter.cycleId && filter.cycleId.$in) {
          const allowedStr = new Set(filter.cycleId.$in.map((id) => id.toString()))
          filter.cycleId = { $in: matchedIds.filter((id) => allowedStr.has(id.toString())) }
        } else {
          filter.cycleId = { $in: matchedIds }
        }
      }
    }

    /* ── 3. Status Filter ── */
    if (status && status.trim() && status.trim() !== 'all') {
      const sVal = status.trim().toLowerCase()
      if (['compliance', 'compliant'].includes(sVal)) {
        filter.$or = [
          { complianceStatus: 'compliance' },
          { complianceStatus: 'compliant' },
          { status: 'compliance' },
          { status: 'compliant' },
        ]
      } else if (['not compliance', 'not_compliance', 'non_compliant', 'not compliant'].includes(sVal)) {
        filter.$or = [
          { complianceStatus: 'not compliance' },
          { complianceStatus: 'not_compliance' },
          { status: 'not compliance' },
          { status: 'not_compliance' },
        ]
      } else if (sVal === 'completed') {
        filter.$or = [
          { status: 'completed' },
          { complianceStatus: 'completed' },
        ]
      } else {
        filter.complianceStatus = status.trim()
      }
    }

    /* ── 4. Submitted By Filter ── */
    if (submittedBy && submittedBy.trim()) {
      const uVal = submittedBy.trim()
      if (mongoose.Types.ObjectId.isValid(uVal)) {
        filter.submittedBy = uVal
      } else {
        const userMatches = await User.find(
          {
            company: req.user.company,
            name: { $regex: uVal, $options: 'i' },
          },
          '_id'
        ).lean()
        filter.submittedBy = { $in: userMatches.map((u) => u._id) }
      }
    }

    /* ── Form Search ── */
    if (search && search.trim()) {
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
