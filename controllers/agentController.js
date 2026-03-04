const Agent          = require('../models/Agent')
const { uploadBuffer } = require('../utils/cloudinary')

/* Helper: upload a req.file buffer to cloudinary if present */
async function resolveImage(file, folder, fallback = '') {
  if (!file) return fallback
  const result = await uploadBuffer(file.buffer, { folder })
  return result.secure_url
}

/* ════════════════════════════════════════════════════════════
   POST /api/agents
   CEO only · accepts multipart/form-data with optional image fields
   ════════════════════════════════════════════════════════════ */
async function createAgent(req, res) {
  try {
    const { name, description, userPrompt, tolerance } = req.body

    // Images: use uploaded file if present, otherwise URL from body
    const image         = await resolveImage(req.files?.image?.[0],         'agents',         req.body.image         || '')
    const passImage     = await resolveImage(req.files?.passImage?.[0],     'agents/results', req.body.passImage     || '')
    const failImage     = await resolveImage(req.files?.failImage?.[0],     'agents/results', req.body.failImage     || '')
    const thinkingImage = await resolveImage(req.files?.thinkingImage?.[0], 'agents/results', req.body.thinkingImage || '')

    const agent = await Agent.create({
      name,
      description,
      userPrompt,
      tolerance: tolerance ? Number(tolerance) : 0,
      image,
      passImage,
      failImage,
      thinkingImage,
      companyId: req.user.company,
      createdBy: req.user._id,
    })

    return res.status(201).json({ success: true, data: { agent } })
  } catch (err) {
    console.error('[createAgent]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/agents
   Query: page, limit, search, sortBy, sortOrder
   ════════════════════════════════════════════════════════════ */
async function getAgents(req, res) {
  try {
    const {
      page      = 1,
      limit     = 10,
      search    = '',
      sortBy    = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    const pageNum  = Math.max(1, parseInt(page,  10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))
    const skip     = (pageNum - 1) * limitNum

    const filter = { companyId: req.user.company, isDeleted: false }

    if (search.trim()) {
      filter.$or = [
        { name:        { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ]
    }

    const ALLOWED_SORT = ['createdAt', 'updatedAt', 'name', 'tolerance', 'like']
    const sortField    = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir      = sortOrder === 'asc' ? 1 : -1

    const [agents, total] = await Promise.all([
      Agent.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum),
      Agent.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limitNum)

    return res.status(200).json({
      success: true,
      data: {
        agents,
        pagination: { total, totalPages, page: pageNum, limit: limitNum, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
      },
    })
  } catch (err) {
    console.error('[getAgents]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/agents/:id
   ════════════════════════════════════════════════════════════ */
async function getAgent(req, res) {
  try {
    const agent = await Agent.findOne({
      _id:       req.params.id,
      companyId: req.user.company,
      isDeleted: false,
    }).populate('createdBy', 'name email')

    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' })
    return res.status(200).json({ success: true, data: { agent } })
  } catch (err) {
    console.error('[getAgent]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   PATCH /api/agents/:id
   ════════════════════════════════════════════════════════════ */
async function updateAgent(req, res) {
  try {
    const { name, description, userPrompt, tolerance } = req.body

    // Resolve any newly uploaded images
    const image         = req.files?.image?.[0]         ? (await resolveImage(req.files.image[0],         'agents'))         : req.body.image
    const passImage     = req.files?.passImage?.[0]     ? (await resolveImage(req.files.passImage[0],     'agents/results')) : req.body.passImage
    const failImage     = req.files?.failImage?.[0]     ? (await resolveImage(req.files.failImage[0],     'agents/results')) : req.body.failImage
    const thinkingImage = req.files?.thinkingImage?.[0] ? (await resolveImage(req.files.thinkingImage[0], 'agents/results')) : req.body.thinkingImage

    // Build update — only include defined fields
    const update = {}
    if (name         !== undefined) update.name         = name
    if (description  !== undefined) update.description  = description
    if (userPrompt   !== undefined) update.userPrompt   = userPrompt
    if (tolerance    !== undefined) update.tolerance    = Number(tolerance)
    if (image        !== undefined) update.image        = image
    if (passImage    !== undefined) update.passImage    = passImage
    if (failImage    !== undefined) update.failImage    = failImage
    if (thinkingImage !== undefined) update.thinkingImage = thinkingImage

    const agent = await Agent.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false },
      update,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')

    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' })
    return res.status(200).json({ success: true, data: { agent } })
  } catch (err) {
    console.error('[updateAgent]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   DELETE /api/agents/:id  — soft delete
   ════════════════════════════════════════════════════════════ */
async function deleteAgent(req, res) {
  try {
    const agent = await Agent.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id },
      { new: true }
    )
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found or already deleted' })
    return res.status(200).json({ success: true, message: 'Agent soft-deleted successfully' })
  } catch (err) {
    console.error('[deleteAgent]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   PATCH /api/agents/:id/like   — increment like
   PATCH /api/agents/:id/dislike — increment dislike
   Any authenticated user (not CEO-only)
   ════════════════════════════════════════════════════════════ */
async function likeAgent(req, res) {
  try {
    const agent = await Agent.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $inc: { like: 1 } },
      { new: true }
    )
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' })
    return res.status(200).json({ success: true, data: { like: agent.like } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

async function dislikeAgent(req, res) {
  try {
    const agent = await Agent.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $inc: { dislike: 1 } },
      { new: true }
    )
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' })
    return res.status(200).json({ success: true, data: { dislike: agent.dislike } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { createAgent, getAgents, getAgent, updateAgent, deleteAgent, likeAgent, dislikeAgent }
