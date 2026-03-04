const Module            = require('../models/Module')
const { uploadBuffer }  = require('../utils/cloudinary')

/* ════════════════════════════════════════════════════════════
   POST /api/modules
   Create a new module (CEO only)
   ════════════════════════════════════════════════════════════ */
async function createModule(req, res) {
  try {
    const { title, description } = req.body

    // If a file was uploaded via multipart, push it to Cloudinary
    let imageUrl = req.body.image || ''
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, { folder: 'modules' })
      imageUrl = result.secure_url
    }

    const module = await Module.create({
      title,
      description,
      image:     imageUrl,
      companyId: req.user.company,
      creatorId: req.user._id,
    })

    return res.status(201).json({ success: true, data: { module } })
  } catch (err) {
    console.error('[createModule]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   GET /api/modules
   Query params:
     page      {number}  default 1
     limit     {number}  default 10  (max 100)
     search    {string}  partial match on title or description
     creatorId {string}  filter by creator ObjectId
     sortBy    {string}  field to sort by (default: createdAt)
     sortOrder {asc|desc} default: desc
   ════════════════════════════════════════════════════════════ */
async function getModules(req, res) {
  try {
    const {
      page      = 1,
      limit     = 10,
      search    = '',
      creatorId = '',
      sortBy    = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    const pageNum  = Math.max(1, parseInt(page,  10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))
    const skip     = (pageNum - 1) * limitNum

    /* ── Build filter ── */
    const filter = { companyId: req.user.company, isDeleted: false }

    if (search.trim()) {
      filter.$or = [
        { title:       { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ]
    }

    if (creatorId.trim()) {
      filter.creatorId = creatorId.trim()
    }

    /* ── Sort ── */
    const ALLOWED_SORT = ['createdAt', 'updatedAt', 'title']
    const sortField    = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir      = sortOrder === 'asc' ? 1 : -1

    /* ── Query ── */
    const [modules, total] = await Promise.all([
      Module.find(filter)
        .populate('creatorId', 'name email')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum),
      Module.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limitNum)

    return res.status(200).json({
      success: true,
      data: {
        modules,
        pagination: {
          total,
          totalPages,
          page:     pageNum,
          limit:    limitNum,
          hasNext:  pageNum < totalPages,
          hasPrev:  pageNum > 1,
        },
      },
    })
  } catch (err) {
    console.error('[getModules]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/modules/:id
   Get a single module by ID (must belong to the CEO's company)
   ════════════════════════════════════════════════════════════ */
async function getModule(req, res) {
  try {
    const module = await Module.findOne({
      _id:       req.params.id,
      companyId: req.user.company,
      isDeleted: false,
    }).populate('creatorId', 'name email')

    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' })
    }

    return res.status(200).json({ success: true, data: { module } })
  } catch (err) {
    console.error('[getModule]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   PATCH /api/modules/:id
   Update a module (CEO only, must own the company)
   ════════════════════════════════════════════════════════════ */
async function updateModule(req, res) {
  try {
    const { title, description, image } = req.body

    const module = await Module.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company },
      { title, description, image },
      { new: true, runValidators: true }
    ).populate('creatorId', 'name email')

    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' })
    }

    return res.status(200).json({ success: true, data: { module } })
  } catch (err) {
    console.error('[updateModule]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   DELETE /api/modules/:id
   Soft-delete: sets isDeleted=true, deletedAt, deletedBy.
   The document is kept in the database for audit purposes.
   ════════════════════════════════════════════════════════════ */
async function deleteModule(req, res) {
  try {
    const module = await Module.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
      },
      { new: true }
    )

    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found or already deleted' })
    }

    return res.status(200).json({ success: true, message: 'Module soft-deleted successfully' })
  } catch (err) {
    console.error('[deleteModule]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { createModule, getModules, getModule, updateModule, deleteModule }
