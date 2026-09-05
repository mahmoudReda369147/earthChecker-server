const Analysis   = require('../models/Analysis')
const Cycle      = require('../models/Cycle')
const Submission = require('../models/Submission')
const Module     = require('../models/Module')
const Agent      = require('../models/Agent')

/* ════════════════════════════════════════════════════════════
   GET /api/overview
   Get aggregated real operation & defect metrics for overview dashboard.
   ════════════════════════════════════════════════════════════ */
async function getOverviewStats(req, res) {
  try {
    const companyId = req.user.company
    const { fromDate, toDate } = req.query

    const dateFilter = {}
    if (fromDate || toDate) {
      dateFilter.createdAt = {}
      if (fromDate) {
        const from = new Date(fromDate)
        if (!isNaN(from.getTime())) {
          from.setHours(0, 0, 0, 0)
          dateFilter.createdAt.$gte = from
        }
      }
      if (toDate) {
        const to = new Date(toDate)
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999)
          dateFilter.createdAt.$lte = to
        }
      }
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    fourteenDaysAgo.setHours(0, 0, 0, 0)

    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    /* ── 1. OVERALL COUNTS & DELTAS (Filtered by Date Range if specified) ── */
    const [
      totalInspections,
      passedInspections,
      failedInspections,
      totalAcceptedCycles,
      totalRejectedCycles,
      curr7Total,
      curr7Passed,
      curr7Failed,
      curr7AcceptedCycles,
      curr7RejectedCycles,
      prev7Total,
      prev7Passed,
      prev7Failed,
      prev7AcceptedCycles,
      prev7RejectedCycles,
    ] = await Promise.all([
      Analysis.countDocuments({ companyId, ...dateFilter }),
      Analysis.countDocuments({ companyId, 'aiResult.result': 'pass', ...dateFilter }),
      Analysis.countDocuments({ companyId, 'aiResult.result': 'fail', ...dateFilter }),

      Cycle.countDocuments({ companyId, isDeleted: false, ...dateFilter, $or: [{ complianceStatus: 'accepted' }, { status: 'completed' }] }),
      Cycle.countDocuments({ companyId, isDeleted: false, ...dateFilter, $or: [{ complianceStatus: 'rejected' }, { status: 'cancelled' }] }),

      Analysis.countDocuments({ companyId, createdAt: { $gte: sevenDaysAgo } }),
      Analysis.countDocuments({ companyId, createdAt: { $gte: sevenDaysAgo }, 'aiResult.result': 'pass' }),
      Analysis.countDocuments({ companyId, createdAt: { $gte: sevenDaysAgo }, 'aiResult.result': 'fail' }),

      Cycle.countDocuments({ companyId, isDeleted: false, createdAt: { $gte: sevenDaysAgo }, $or: [{ complianceStatus: 'accepted' }, { status: 'completed' }] }),
      Cycle.countDocuments({ companyId, isDeleted: false, createdAt: { $gte: sevenDaysAgo }, $or: [{ complianceStatus: 'rejected' }, { status: 'cancelled' }] }),

      Analysis.countDocuments({ companyId, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } }),
      Analysis.countDocuments({ companyId, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }, 'aiResult.result': 'pass' }),
      Analysis.countDocuments({ companyId, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }, 'aiResult.result': 'fail' }),

      Cycle.countDocuments({ companyId, isDeleted: false, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }, $or: [{ complianceStatus: 'accepted' }, { status: 'completed' }] }),
      Cycle.countDocuments({ companyId, isDeleted: false, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }, $or: [{ complianceStatus: 'rejected' }, { status: 'cancelled' }] }),
    ])

    // Wastage costs from Submissions
    const scrapAggAll = await Submission.aggregate([
      { $match: { companyId, ...dateFilter } },
      { $group: { _id: null, totalScrapCost: { $sum: '$scrapCost' }, totalScrap: { $sum: '$scrap' } } },
    ])
    const wastageCostVal = scrapAggAll[0]?.totalScrapCost || (failedInspections * 2.0)
    const totalScrapItems = scrapAggAll[0]?.totalScrap || failedInspections

    const scrapAggCurr7 = await Submission.aggregate([
      { $match: { companyId, createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: null, totalScrapCost: { $sum: '$scrapCost' } } },
    ])
    const curr7Wastage = scrapAggCurr7[0]?.totalScrapCost || (curr7Failed * 2.0)

    const scrapAggPrev7 = await Submission.aggregate([
      { $match: { companyId, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
      { $group: { _id: null, totalScrapCost: { $sum: '$scrapCost' } } },
    ])
    const prev7Wastage = scrapAggPrev7[0]?.totalScrapCost || (prev7Failed * 2.0)

    const acceptanceRateNum = totalInspections > 0
      ? ((passedInspections / totalInspections) * 100)
      : 0.0

    const acceptanceRate = `${acceptanceRateNum.toFixed(1)}%`
    const wastageCostFormatted = `$${Math.round(wastageCostVal).toLocaleString()}`

    // Deltas calculation helper
    const calcPctDelta = (curr, prev) => {
      if (prev === 0) return { delta: curr > 0 ? '+100%' : '0%', isUp: true }
      const diff = curr - prev
      const pct = (diff / prev) * 100
      return { delta: `${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%`, isUp: diff >= 0 }
    }

    const calcValueDelta = (curr, prev, isCurrency = false) => {
      const diff = curr - prev
      if (isCurrency) {
        return { delta: `${diff >= 0 ? '+$' : '-$'}${Math.abs(Math.round(diff)).toLocaleString()}`, isUp: diff <= 0 }
      }
      return { delta: `${diff >= 0 ? '+' : ''}${diff}`, isUp: diff <= 0 }
    }

    const volumeDelta = calcPctDelta(curr7Total, prev7Total)
    const acceptedCyclesDelta = calcPctDelta(curr7AcceptedCycles, prev7AcceptedCycles)
    const rejectedCyclesDelta = calcPctDelta(curr7RejectedCycles, prev7RejectedCycles)
    const wastageDelta = calcValueDelta(curr7Wastage, prev7Wastage, true)

    /* ── 7-Day Continuous Sparkline Data ── */
    const dateLabels = []
    const dateMap = {}

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = d.toISOString().split('T')[0]
      dateLabels.push(dateStr)
      dateMap[dateStr] = { total: 0, passed: 0, failed: 0, wastage: 0, acceptedCycles: 0, rejectedCycles: 0 }
    }

    const dailyAnalysisStats = await Analysis.aggregate([
      { $match: { companyId, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          passed: { $sum: { $cond: [{ $eq: ['$aiResult.result', 'pass'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$aiResult.result', 'fail'] }, 1, 0] } },
        },
      },
    ])

    const dailyCycleStats = await Cycle.aggregate([
      { $match: { companyId, isDeleted: false, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          accepted: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ['$complianceStatus', 'accepted'] }, { $eq: ['$status', 'completed'] }] },
                1,
                0,
              ],
            },
          },
          rejected: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ['$complianceStatus', 'rejected'] }, { $eq: ['$status', 'cancelled'] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ])

    const dailySubStats = await Submission.aggregate([
      { $match: { companyId, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          wastage: { $sum: '$scrapCost' },
        },
      },
    ])

    dailyAnalysisStats.forEach((d) => {
      if (dateMap[d._id]) {
        dateMap[d._id].total = d.total
        dateMap[d._id].passed = d.passed
        dateMap[d._id].failed = d.failed
      }
    })

    dailyCycleStats.forEach((c) => {
      if (dateMap[c._id]) {
        dateMap[c._id].acceptedCycles = c.accepted
        dateMap[c._id].rejectedCycles = c.rejected
      }
    })

    dailySubStats.forEach((s) => {
      if (dateMap[s._id]) {
        dateMap[s._id].wastage = s.wastage
      }
    })

    const inspectionSparkData = dateLabels.map((date) => dateMap[date].total)
    const acceptedCyclesSparkData = dateLabels.map((date) => dateMap[date].acceptedCycles)
    const rejectedCyclesSparkData = dateLabels.map((date) => dateMap[date].rejectedCycles)
    const wastageSparkData = dateLabels.map((date) => dateMap[date].wastage || dateMap[date].failed * 2)

    const kpiCards = [
      {
        label: 'Total Inspections',
        value: totalInspections.toLocaleString(),
        delta: volumeDelta.delta,
        isUp: volumeDelta.isUp,
        accentColor: '#00d4ff',
        sublabel: '7-Day Volume Trend',
        sparkData: inspectionSparkData,
        key: 'totalInspections',
      },
      {
        label: 'Total Accepted Cycles',
        value: totalAcceptedCycles.toLocaleString(),
        delta: acceptedCyclesDelta.delta,
        isUp: acceptedCyclesDelta.isUp,
        accentColor: '#10b981',
        sublabel: 'Completed & Approved Runs',
        sparkData: acceptedCyclesSparkData,
        key: 'totalAcceptedCycles',
      },
      {
        label: 'Total Rejected Cycles',
        value: totalRejectedCycles.toLocaleString(),
        delta: rejectedCyclesDelta.delta,
        isUp: rejectedCyclesDelta.isUp,
        accentColor: '#c87941',
        sublabel: 'Non-Compliant & Failed Runs',
        sparkData: rejectedCyclesSparkData,
        key: 'totalRejectedCycles',
      },
      {
        label: 'Estimated Wastage Cost',
        value: wastageCostFormatted,
        delta: wastageDelta.delta,
        isUp: wastageDelta.isUp,
        accentColor: '#f59e0b',
        sublabel: `${totalScrapItems.toLocaleString()} items • Dynamic unit scrap`,
        sparkData: wastageSparkData,
        key: 'wastageCost',
      },
    ]

    /* ── 2. DEFECT ANALYTICS & PROBLEM TYPES WITH DYNAMIC SOURCES ── */
    const defectTypesAgg = await Analysis.aggregate([
      { $match: { companyId, 'aiResult.result': 'fail', ...dateFilter } },
      {
        $lookup: {
          from: 'submissions',
          localField: 'submissionId',
          foreignField: '_id',
          as: 'sub',
        },
      },
      { $unwind: { path: '$sub', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'modules',
          localField: 'sub.moduleId',
          foreignField: '_id',
          as: 'mod',
        },
      },
      { $unwind: { path: '$mod', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'agents',
          localField: 'agentId',
          foreignField: '_id',
          as: 'agentDoc',
        },
      },
      { $unwind: { path: '$agentDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$problemType', { $ifNull: ['$aiResult.problemType', 'Quality Inspection Defect'] }] },
          count: { $sum: 1 },
          moduleName: { $first: '$mod.title' },
          agentName: { $first: '$agentDoc.name' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ])

    const totalDefectsCount = defectTypesAgg.reduce((acc, curr) => acc + curr.count, 0) || 1
    const colors = ['#c87941', '#f97316', '#eab308', '#00d4ff', '#a855f7', '#ec4899']

    const topDefectTypes = defectTypesAgg.map((item, idx) => ({
      name: item._id,
      count: item.count,
      percentage: Math.round((item.count / totalDefectsCount) * 100),
      color: colors[idx % colors.length],
      machine: item.moduleName || item.agentName || 'Production Station',
    }))

    /* ── 3. DEFECTS BY PRODUCTION MODULE ── */
    const companyModules = await Module.find({ companyId, isDeleted: false }).lean()

    const moduleDefectsAgg = await Analysis.aggregate([
      { $match: { companyId, ...dateFilter } },
      {
        $lookup: {
          from: 'submissions',
          localField: 'submissionId',
          foreignField: '_id',
          as: 'sub',
        },
      },
      { $unwind: '$sub' },
      {
        $group: {
          _id: '$sub.moduleId',
          total: { $sum: 1 },
          defects: {
            $sum: { $cond: [{ $eq: ['$aiResult.result', 'fail'] }, 1, 0] },
          },
        },
      },
    ])

    const moduleDefectsMap = {}
    moduleDefectsAgg.forEach((m) => {
      if (m._id) moduleDefectsMap[m._id.toString()] = m
    })

    const defectsByModule = companyModules.map((mod, idx) => {
      const stats = moduleDefectsMap[mod._id.toString()] || { total: 0, defects: 0 }
      const rateNum = stats.total > 0 ? (stats.defects / stats.total) * 100 : 0
      const rateStr = `${rateNum.toFixed(1)}%`
      const isHigh = rateNum > 5.0

      return {
        moduleId: mod._id,
        moduleName: mod.title || 'Production Module',
        defects: stats.defects,
        total: stats.total,
        rate: rateStr,
        status: isHigh ? 'warning' : 'good',
        barColor: isHigh ? '#c87941' : (colors[idx % colors.length] || '#00d4ff'),
      }
    }).sort((a, b) => b.defects - a.defects)

    /* ── 4. HOURLY TIMELINE (7 AM to Current Hour for Default, 24 Hours for Selected Date Filter) ── */
    const isFiltered = Boolean(fromDate || toDate)
    const currentHour = now.getHours()

    let hourlyTimelineHours = []
    let hourlyMatch = { companyId }

    if (isFiltered) {
      hourlyMatch = { companyId, ...dateFilter }
      // Show full 24 hours (00:00 to 23:00) for selected date range
      for (let h = 0; h < 24; h++) {
        hourlyTimelineHours.push(h)
      }
    } else {
      // Default view: 7 AM to current hour today
      const startHour = 7
      if (currentHour >= startHour) {
        const todayStart = new Date(now)
        todayStart.setHours(7, 0, 0, 0)
        hourlyMatch = { companyId, createdAt: { $gte: todayStart } }
        for (let h = startHour; h <= currentHour; h++) {
          hourlyTimelineHours.push(h)
        }
      } else {
        // If current hour is before 7 AM, show 24 hours up to current hour
        hourlyMatch = { companyId, createdAt: { $gte: twentyFourHoursAgo } }
        for (let i = 23; i >= 0; i--) {
          hourlyTimelineHours.push((currentHour - i + 24) % 24)
        }
      }
    }

    const hourlyAgg = await Analysis.aggregate([
      { $match: hourlyMatch },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          total: { $sum: 1 },
          pass: { $sum: { $cond: [{ $eq: ['$aiResult.result', 'pass'] }, 1, 0] } },
          fail: { $sum: { $cond: [{ $eq: ['$aiResult.result', 'fail'] }, 1, 0] } },
        },
      },
    ])

    const hourlyMap = {}
    hourlyAgg.forEach((h) => {
      hourlyMap[h._id] = h
    })

    const totalFailsInPeriod = hourlyAgg.reduce((acc, h) => acc + h.fail, 0)
    const avgFailPerHour = hourlyTimelineHours.length > 0 ? totalFailsInPeriod / hourlyTimelineHours.length : 0

    const hourlyTimeline = hourlyTimelineHours.map((h) => {
      const slotTotal = hourlyMap[h]?.total || 0
      const slotPass = hourlyMap[h]?.pass || 0
      const slotFail = hourlyMap[h]?.fail || 0
      const hourStr = `${String(h).padStart(2, '0')}:00`
      const hasSpike = slotFail > 0 && slotFail >= Math.max(3, avgFailPerHour * 2)

      return {
        time: hourStr + (hasSpike ? ' (Spike)' : ''),
        total: slotTotal,
        pass: slotPass,
        fail: slotFail,
        hasSpike,
      }
    })

    /* ── 5. SHIFT PERFORMANCE COMPARISON (Morning: 06:00-14:00 vs Evening: 14:00-22:00) ── */
    const shiftsAgg = await Analysis.aggregate([
      { $match: { companyId, ...dateFilter } },
      {
        $project: {
          result: '$aiResult.result',
          hour: { $hour: '$createdAt' },
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $and: [{ $gte: ['$hour', 6] }, { $lt: ['$hour', 14] }] },
              'morning',
              { $cond: [{ $and: [{ $gte: ['$hour', 14] }, { $lt: ['$hour', 22] }] }, 'evening', 'night'] },
            ],
          },
          total: { $sum: 1 },
          pass: { $sum: { $cond: [{ $eq: ['$result', 'pass'] }, 1, 0] } },
          fail: { $sum: { $cond: [{ $eq: ['$result', 'fail'] }, 1, 0] } },
        },
      },
    ])

    const morningData = shiftsAgg.find((s) => s._id === 'morning')
    const eveningData = shiftsAgg.find((s) => s._id === 'evening')

    const morningTotal = morningData ? morningData.total : 0
    const morningFail = morningData ? morningData.fail : 0
    const morningPass = morningData ? morningData.pass : 0
    const morningRate = morningTotal > 0 ? `${((morningPass / morningTotal) * 100).toFixed(1)}%` : '100.0%'
    const morningSpeed = morningTotal > 0 ? `${(morningTotal / (8 * 60)).toFixed(1)} items/min` : '0.0 items/min'

    const eveningTotal = eveningData ? eveningData.total : 0
    const eveningFail = eveningData ? eveningData.fail : 0
    const eveningPass = eveningData ? eveningData.pass : 0
    const eveningRate = eveningTotal > 0 ? `${((eveningPass / eveningTotal) * 100).toFixed(1)}%` : '100.0%'
    const eveningSpeed = eveningTotal > 0 ? `${(eveningTotal / (8 * 60)).toFixed(1)} items/min` : '0.0 items/min'

    const shiftComparison = {
      morning: {
        shift: 'Morning Shift (06:00 - 14:00)',
        total: morningTotal,
        passRate: morningRate,
        defects: morningFail,
        wastage: `$${(morningFail * 2).toLocaleString()}`,
        speed: morningSpeed,
      },
      evening: {
        shift: 'Evening Shift (14:00 - 22:00)',
        total: eveningTotal,
        passRate: eveningRate,
        defects: eveningFail,
        wastage: `$${(eveningFail * 2).toLocaleString()}`,
        speed: eveningSpeed,
      },
    }

    /* ── 6. MANUAL REVIEW QUEUE & AI MODEL HEALTH ── */
    const avgConfidenceAgg = await Analysis.aggregate([
      { $match: { companyId, ...dateFilter } },
      { $group: { _id: null, avgConf: { $avg: '$aiResult.confidence' } } },
    ])
    const avgConfidenceVal = avgConfidenceAgg[0]?.avgConf != null
      ? `${avgConfidenceAgg[0].avgConf.toFixed(1)}% Avg Score`
      : '100.0% Avg Score'

    const reviewQueueAnalyses = await Analysis.find({
      companyId,
      ...dateFilter,
      $or: [
        { 'aiResult.confidence': { $lt: 75 } },
        { userRating: 'dislike' },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('agentId', 'name image userPrompt')
      .populate({
        path: 'submissionId',
        select: 'submittedBy moduleId formId',
        populate: [
          { path: 'submittedBy', select: 'name' },
          { path: 'moduleId', select: 'title' },
        ],
      })
      .lean()

    const reviewQueueCount = await Analysis.countDocuments({
      companyId,
      ...dateFilter,
      $or: [
        { 'aiResult.confidence': { $lt: 75 } },
        { userRating: 'dislike' },
      ],
    })

    /* ── 7. AI AGENTS PERFORMANCE MATRIX & VERDICT DISTRIBUTION ── */
    const companyAgents = await Agent.find({ companyId, isDeleted: false }).lean()

    const agentStatsAgg = await Analysis.aggregate([
      { $match: { companyId, ...dateFilter } },
      {
        $group: {
          _id: '$agentId',
          total: { $sum: 1 },
          pass: { $sum: { $cond: [{ $eq: ['$aiResult.result', 'pass'] }, 1, 0] } },
          fail: { $sum: { $cond: [{ $eq: ['$aiResult.result', 'fail'] }, 1, 0] } },
          avgConfidence: { $avg: '$aiResult.confidence' },
        },
      },
    ])

    const agentStatsMap = {}
    agentStatsAgg.forEach((a) => {
      if (a._id) agentStatsMap[a._id.toString()] = a
    })

    const aiAgents = companyAgents.map((ag) => {
      const stats = agentStatsMap[ag._id.toString()] || { total: 0, pass: 0, fail: 0, avgConfidence: 100 }
      const total = stats.total
      const passCount = stats.pass
      const failCount = stats.fail
      const accRate = total > 0 ? `${((passCount / total) * 100).toFixed(1)}%` : '100.0%'
      const avgConf = stats.avgConfidence != null ? `${stats.avgConfidence.toFixed(1)}%` : '100.0%'

      return {
        id: ag._id,
        name: ag.name,
        image: ag.image || '',
        tolerance: ag.tolerance ?? 0,
        complianceThreshold: ag.complianceThreshold ?? 80,
        critical: ag.criticalInspection !== false,
        totalInspections: total,
        passCount,
        failCount,
        accuracyRate: accRate,
        avgConfidence: avgConf,
        likes: ag.like || 0,
        dislikes: ag.dislike || 0,
      }
    })

    const dislikedCount = await Analysis.countDocuments({ companyId, userRating: 'dislike', ...dateFilter })
    const aiVerdictDistribution = {
      total: totalInspections,
      pass: passedInspections,
      fail: failedInspections,
      disliked: dislikedCount,
      passRate: acceptanceRate,
    }

    /* ── 8. RECENT OPERATIONAL CYCLES ── */
    const recentCyclesDocs = await Cycle.find({ companyId, isDeleted: false, ...dateFilter })
      .populate('moduleId', 'title')
      .populate('assignedSupervisor', 'name')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean()

    const recentCycles = await Promise.all(
      recentCyclesDocs.map(async (c) => {
        const submissionCount = await Submission.countDocuments({ cycleId: c._id })
        const submissions = await Submission.find({ cycleId: c._id }, '_id complianceStatus status').lean()
        
        const acceptedCount = submissions.filter(
          (s) => s.complianceStatus === 'compliance' || s.status === 'compliance'
        ).length

        return {
          id: c.cycleId || `CYC-${c._id.toString().slice(-4)}`,
          module: c.moduleId?.title || c.name || 'Inspection Run',
          batches: c.totalBatchSize > 0 ? c.totalBatchSize : (submissionCount > 0 ? submissionCount : 1),
          accepted: acceptedCount,
          status: c.status || 'completed',
          complianceStatus: c.complianceStatus || 'pending',
          rawId: c._id,
        }
      })
    )

    return res.status(200).json({
      success: true,
      data: {
        kpiCards,
        topDefectTypes,
        defectsByModule,
        hourlyTimeline,
        shiftComparison,
        aiHealth: {
          avgConfidence: avgConfidenceVal,
          reviewQueueCount,
          reviewQueue: reviewQueueAnalyses,
        },
        aiAgents,
        aiVerdictDistribution,
        recentCycles,
      },
    })
  } catch (err) {
    console.error('[getOverviewStats]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getOverviewStats }
