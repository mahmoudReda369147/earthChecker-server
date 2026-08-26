const Cycle = require('../models/Cycle')
const Stage = require('../models/Stage')
const Form  = require('../models/Form')

const POPULATE = [
  { path: 'moduleId',           select: 'name title' },
  { path: 'assignedSupervisor', select: 'name email image' },
  { path: 'assignedWorker',     select: 'name email image' },
  { path: 'createdBy',          select: 'name'       },
]

/* ════════════════════════════════════════════════════════════
   GET /api/cycles
   ════════════════════════════════════════════════════════════ */
async function getCycles(req, res) {
  try {
    const {
      page       = 1,
      limit      = 10,
      search     = '',
      status     = '',
      moduleId   = '',
      supervisor = '',
      sortBy     = 'createdAt',
      sortOrder  = 'desc',
    } = req.query

    const pageNum  = Math.max(1, parseInt(page,  10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))
    const skip     = (pageNum - 1) * limitNum

    const filter = { companyId: req.user.company, isDeleted: false }

    /* Scope by role */
    if (req.user.role === 'supervisor') filter.assignedSupervisor = req.user._id
    if (req.user.role === 'worker')     filter.assignedWorker     = req.user._id

    if (search.trim()) {
      filter.$or = [
        { name:    { $regex: search.trim(), $options: 'i' } },
        { cycleId: { $regex: search.trim(), $options: 'i' } },
      ]
    }

    if (status.trim() && ['new','inProgress','paused','cancelledRequest','cancelled','completed'].includes(status)) {
      filter.status = status
    }

    if (moduleId.trim())   filter.moduleId          = moduleId.trim()
    if (supervisor.trim()) filter.assignedSupervisor = supervisor.trim()

    const ALLOWED_SORT = ['createdAt', 'updatedAt', 'name', 'status', 'progress']
    const sortField    = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir      = sortOrder === 'asc' ? 1 : -1

    const [cycles, total] = await Promise.all([
      Cycle.find(filter)
        .populate(POPULATE)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum),
      Cycle.countDocuments(filter),
    ])

    return res.status(200).json({
      success: true,
      data: {
        cycles,
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
    console.error('[getCycles]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   POST /api/cycles
   CEO must assign supervisor. Supervisor assigned to self.
   ════════════════════════════════════════════════════════════ */
async function createCycle(req, res) {
  try {
    const { name, moduleId, assignedSupervisor, assignedWorker } = req.body

    if (!name || !moduleId) {
      return res.status(400).json({ success: false, message: 'name and moduleId are required' })
    }

    let supervisorId
    if (req.user.role === 'ceo') {
      if (!assignedSupervisor) {
        return res.status(400).json({ success: false, message: 'CEO must assign a supervisor to the cycle' })
      }
      supervisorId = assignedSupervisor
    } else {
      supervisorId = req.user._id // supervisor → self-assigned
    }

    const cycle = await Cycle.create({
      name,
      moduleId,
      assignedSupervisor: supervisorId,
      assignedWorker:     assignedWorker || null,
      companyId:          req.user.company,
      createdBy:          req.user._id,
    })

    await cycle.populate(POPULATE)

    /* ── Auto-create stages from module forms ── */
    const forms = await Form.find({ moduleId, isDeleted: false })
      .select('_id order')
      .sort({ order: 1 })
      .lean()

    if (forms.length > 0) {
      const stages = forms.map((f, i) => ({
        cycleId:   cycle._id,
        formId:    f._id,
        moduleId,
        order:     f.order ?? i,
        status:    i === 0 ? 'available' : 'locked',
        companyId: req.user.company,
      }))
      await Stage.insertMany(stages)
    }

    return res.status(201).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[createCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   GET /api/cycles/:id
   ════════════════════════════════════════════════════════════ */
async function getCycle(req, res) {
  try {
    const filter = { _id: req.params.id, companyId: req.user.company, isDeleted: false }
    if (req.user.role === 'supervisor') filter.assignedSupervisor = req.user._id
    if (req.user.role === 'worker')     filter.assignedWorker     = req.user._id

    const cycle = await Cycle.findOne(filter).populate(POPULATE)
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[getCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id
   Edit: name, moduleId, progress, assignedSupervisor (CEO only).
   Both CEO and Supervisor can edit, but supervisor only own cycles.
   ════════════════════════════════════════════════════════════ */
async function updateCycle(req, res) {
  try {
    const filter = { _id: req.params.id, companyId: req.user.company, isDeleted: false }
    if (req.user.role === 'supervisor') filter.assignedSupervisor = req.user._id

    const { name, moduleId, assignedSupervisor, assignedWorker } = req.body
    const updates = {}
    if (name     !== undefined) updates.name     = name
    if (moduleId !== undefined) updates.moduleId = moduleId

    /* Only CEO can reassign supervisor */
    if (assignedSupervisor !== undefined && req.user.role === 'ceo') {
      updates.assignedSupervisor = assignedSupervisor
    }

    /* CEO or supervisor can assign/reassign worker */
    if (assignedWorker !== undefined) {
      updates.assignedWorker = assignedWorker || null
    }

    const cycle = await Cycle.findOneAndUpdate(filter, updates, { new: true, runValidators: true })
      .populate(POPULATE)

    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[updateCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   DELETE /api/cycles/:id  —  CEO only, soft delete
   ════════════════════════════════════════════════════════════ */
async function deleteCycle(req, res) {
  try {
    const cycle = await Cycle.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id },
      { new: true }
    )
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' })
    return res.status(200).json({ success: true, message: 'Cycle deleted' })
  } catch (err) {
    console.error('[deleteCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id/start  —  new → inProgress
   CEO or supervisor (own cycle).
   ════════════════════════════════════════════════════════════ */
async function startCycle(req, res) {
  try {
    const filter = { _id: req.params.id, companyId: req.user.company, isDeleted: false, status: 'new' }
    if (req.user.role === 'supervisor') filter.assignedSupervisor = req.user._id

    const cycle = await Cycle.findOneAndUpdate(filter, { status: 'inProgress' }, { new: true }).populate(POPULATE)
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found or not in "new" status' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[startCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id/pause
   CEO: direct. Supervisor: requires pauseMessage, own cycle only.
   Allowed from: inProgress
   ════════════════════════════════════════════════════════════ */
async function pauseCycle(req, res) {
  try {
    const filter = { _id: req.params.id, companyId: req.user.company, isDeleted: false, status: 'inProgress' }
    if (req.user.role === 'supervisor') {
      filter.assignedSupervisor = req.user._id
      if (!req.body.message?.trim()) {
        return res.status(400).json({ success: false, message: 'A pause reason is required' })
      }
    }

    const cycle = await Cycle.findOneAndUpdate(
      filter,
      { status: 'paused', pauseMessage: req.body.message?.trim() || '' },
      { new: true }
    ).populate(POPULATE)

    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found or not in "inProgress" status' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[pauseCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id/resume  —  paused → inProgress
   CEO or supervisor (own cycle).
   ════════════════════════════════════════════════════════════ */
async function resumeCycle(req, res) {
  try {
    const filter = { _id: req.params.id, companyId: req.user.company, isDeleted: false, status: 'paused' }
    if (req.user.role === 'supervisor') filter.assignedSupervisor = req.user._id

    const cycle = await Cycle.findOneAndUpdate(
      filter,
      { status: 'inProgress', pauseMessage: '' },
      { new: true }
    ).populate(POPULATE)

    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found or not paused' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[resumeCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id/cancel-request  —  Supervisor only
   inProgress / paused → cancelledRequest
   ════════════════════════════════════════════════════════════ */
async function cancelRequest(req, res) {
  try {
    if (!req.body.message?.trim()) {
      return res.status(400).json({ success: false, message: 'A cancellation reason is required' })
    }

    const cycle = await Cycle.findOneAndUpdate(
      {
        _id:                req.params.id,
        companyId:          req.user.company,
        isDeleted:          false,
        assignedSupervisor: req.user._id,
        status:             { $in: ['inProgress', 'paused'] },
      },
      { status: 'cancelledRequest', cancelRequestMessage: req.body.message.trim() },
      { new: true }
    ).populate(POPULATE)

    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found or not in a cancellable state' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[cancelRequest]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id/cancel  —  CEO only
   Cancel directly (any active status) or approve cancel request.
   ════════════════════════════════════════════════════════════ */
async function cancelCycle(req, res) {
  try {
    const cycle = await Cycle.findOneAndUpdate(
      {
        _id:       req.params.id,
        companyId: req.user.company,
        isDeleted: false,
        status:    { $in: ['new', 'inProgress', 'paused', 'cancelledRequest'] },
      },
      { status: 'cancelled' },
      { new: true }
    ).populate(POPULATE)

    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found or cannot be cancelled' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[cancelCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id/reject-cancel  —  CEO only
   Reject supervisor's cancel request → back to inProgress
   ════════════════════════════════════════════════════════════ */
async function rejectCancel(req, res) {
  try {
    const cycle = await Cycle.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false, status: 'cancelledRequest' },
      { status: 'inProgress', cancelRequestMessage: '' },
      { new: true }
    ).populate(POPULATE)

    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found or no pending cancel request' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[rejectCancel]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/cycles/:id/complete  —  CEO only
   inProgress → completed
   ════════════════════════════════════════════════════════════ */
async function completeCycle(req, res) {
  try {
    const cycle = await Cycle.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false, status: 'inProgress' },
      { status: 'completed', progress: 100 },
      { new: true }
    ).populate(POPULATE)

    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found or not in progress' })

    return res.status(200).json({ success: true, data: { cycle } })
  } catch (err) {
    console.error('[completeCycle]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


module.exports = {
  getCycles, createCycle, getCycle, updateCycle, deleteCycle,
  startCycle, pauseCycle, resumeCycle, cancelRequest, cancelCycle,
  rejectCancel, completeCycle,
}
