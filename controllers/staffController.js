const User = require('../models/User')

/* Role rank — higher number = more authority */
const ROLE_RANK = { ceo: 3, supervisor: 2, worker: 1 }

/* ════════════════════════════════════════════════════════════
   GET /api/staff
   List all staff in the caller's company (excluding caller).
   Query: page, limit, search, role
   ════════════════════════════════════════════════════════════ */
async function getStaff(req, res) {
  try {
    const {
      page      = 1,
      limit     = 10,
      search    = '',
      role      = '',
      sortBy    = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    const pageNum  = Math.max(1, parseInt(page,  10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))
    const skip     = (pageNum - 1) * limitNum

    const filter = {
      company: req.user.company,
      _id:     { $ne: req.user._id }, // exclude caller
    }

    if (search.trim()) {
      filter.$or = [
        { name:  { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ]
    }

    if (role.trim() && ['ceo', 'supervisor', 'worker'].includes(role.trim())) {
      filter.role = role.trim()
    }

    const ALLOWED_SORT = ['createdAt', 'updatedAt', 'name', 'role']
    const sortField    = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir      = sortOrder === 'asc' ? 1 : -1

    const [staff, total] = await Promise.all([
      User.find(filter)
        .populate('createdBy', 'name')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .select('-password'),
      User.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limitNum)

    return res.status(200).json({
      success: true,
      data: {
        staff,
        pagination: {
          total,
          totalPages,
          page:    pageNum,
          limit:   limitNum,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      },
    })
  } catch (err) {
    console.error('[getStaff]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   POST /api/staff
   Create a new staff member (CEO or Supervisor only).
   New account is immediately active — no email verification.
   Body: { name, email, password, role }
   ════════════════════════════════════════════════════════════ */
async function createStaff(req, res) {
  try {
    const { name, email, password, role, image } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, email, password and role are required' })
    }

    /* Role rank guard */
    const callerRank = ROLE_RANK[req.user.role]
    const targetRank = ROLE_RANK[role]

    if (targetRank === undefined) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be ceo, supervisor, or worker' })
    }

    if (targetRank > callerRank) {
      return res.status(403).json({
        success: false,
        message: `You cannot create a user with role '${role}' — it exceeds your own role`,
      })
    }

    /* Check email uniqueness */
    const existing = await User.findOne({ email: email.toLowerCase().trim() })
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists' })
    }

    const member = await User.create({
      name:            name.trim(),
      email:           email.toLowerCase().trim(),
      password,
      role,
      image:           image || '',
      company:         req.user.company,
      isEmailVerified: true,  // admin-created accounts skip email verification
      isActive:        true,
      createdBy:       req.user._id,
    })

    const safe = member.toObject()
    delete safe.password

    return res.status(201).json({ success: true, data: { staff: safe } })
  } catch (err) {
    console.error('[createStaff]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   GET /api/staff/:id
   Get a single staff member (must be in same company).
   ════════════════════════════════════════════════════════════ */
async function getStaffMember(req, res) {
  try {
    const member = await User.findOne({
      _id:     req.params.id,
      company: req.user.company,
    })
      .populate('createdBy', 'name')
      .select('-password')

    if (!member) {
      return res.status(404).json({ success: false, message: 'Staff member not found' })
    }

    return res.status(200).json({ success: true, data: { staff: member } })
  } catch (err) {
    console.error('[getStaffMember]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/staff/:id
   Update name, role, isActive.
   Guards:
   - Cannot edit yourself via this endpoint
   - Cannot set role higher than your own
   - Cannot edit a member whose role outranks yours
   ════════════════════════════════════════════════════════════ */
async function updateStaff(req, res) {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Use the settings page to edit your own account' })
    }

    const member = await User.findOne({ _id: req.params.id, company: req.user.company })
    if (!member) {
      return res.status(404).json({ success: false, message: 'Staff member not found' })
    }

    const callerRank = ROLE_RANK[req.user.role]
    const targetRank = ROLE_RANK[member.role]

    if (targetRank > callerRank) {
      return res.status(403).json({ success: false, message: 'You cannot edit a user with a higher role than yours' })
    }

    const updates = {}
    if (req.body.name     !== undefined) updates.name     = req.body.name.trim()
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive
    if (req.body.image    !== undefined) updates.image    = req.body.image

    if (req.body.role !== undefined) {
      const newRank = ROLE_RANK[req.body.role]
      if (newRank === undefined) {
        return res.status(400).json({ success: false, message: 'Invalid role' })
      }
      if (newRank > callerRank) {
        return res.status(403).json({
          success: false,
          message: `You cannot assign role '${req.body.role}' — it exceeds your own role`,
        })
      }
      updates.role = req.body.role
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('createdBy', 'name')
      .select('-password')

    return res.status(200).json({ success: true, data: { staff: updated } })
  } catch (err) {
    console.error('[updateStaff]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   DELETE /api/staff/:id
   Deactivate: sets isActive = false.
   Guards: cannot deactivate yourself, cannot deactivate higher-rank users.
   ════════════════════════════════════════════════════════════ */
async function deleteStaff(req, res) {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' })
    }

    const member = await User.findOne({ _id: req.params.id, company: req.user.company })
    if (!member) {
      return res.status(404).json({ success: false, message: 'Staff member not found' })
    }

    const callerRank = ROLE_RANK[req.user.role]
    const targetRank = ROLE_RANK[member.role]

    if (targetRank > callerRank) {
      return res.status(403).json({ success: false, message: 'You cannot deactivate a user with a higher role than yours' })
    }

    await User.findByIdAndUpdate(req.params.id, { isActive: false })

    return res.status(200).json({ success: true, message: 'Staff member deactivated' })
  } catch (err) {
    console.error('[deleteStaff]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


module.exports = { getStaff, createStaff, getStaffMember, updateStaff, deleteStaff }
