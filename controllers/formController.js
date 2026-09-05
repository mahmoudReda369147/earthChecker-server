const Form = require('../models/Form')
function validateImageSections(sections) {
  if (!Array.isArray(sections)) return null
  for (const s of sections) {
    if (s && s.type === 'image') {
      const mode = s.setting?.sizeMode || 'sampleSizeBased'
      if (mode === 'customSize') {
        const sz = Number(s.setting?.size)
        if (s.setting?.size === null || s.setting?.size === undefined || isNaN(sz) || sz <= 0) {
          return `Size field is required and must be greater than 0 for image section "${s.title || 'Untitled'}" when Customize Size is selected.`
        }
      }
    }
  }
  return null
}

/* ════════════════════════════════════════════════════════════
   POST /api/forms
   Create a new form (CEO only)
   ════════════════════════════════════════════════════════════ */
async function createForm(req, res) {
  try {
    const { name, description, moduleId, sections } = req.body

    const valErr = validateImageSections(sections)
    if (valErr) {
      return res.status(400).json({ success: false, message: valErr })
    }

    const form = await Form.create({
      name,
      description,
      moduleId,
      sections:  sections || [],
      createdBy: req.user._id,
      companyId: req.user.company,
    })

    await form.populate([
      { path: 'createdBy',               select: 'name email' },
      { path: 'moduleId',                select: 'title'      },
      { path: 'sections.assignedBotId',  select: 'name'       },
    ])

    return res.status(201).json({ success: true, data: { form } })
  } catch (err) {
    console.error('[createForm]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   GET /api/forms
   Query params:
     page      {number}   default 1
     limit     {number}   default 10  (max 100)
     search    {string}   partial match on name or description
     moduleId  {string}   filter by module ObjectId
     sortBy    {string}   createdAt | updatedAt | name  (default: createdAt)
     sortOrder {asc|desc} default: desc
   ════════════════════════════════════════════════════════════ */
async function getForms(req, res) {
  try {
    const {
      page      = 1,
      limit     = 10,
      search    = '',
      moduleId  = '',
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
        { name:        { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ]
    }

    if (moduleId.trim()) {
      filter.moduleId = moduleId.trim()
    }

    /* ── Sort ── */
    const ALLOWED_SORT = ['createdAt', 'updatedAt', 'name', 'order']
    const sortField    = ALLOWED_SORT.includes(sortBy) ? sortBy : (moduleId.trim() ? 'order' : 'createdAt')
    // When sorting by order always use asc (0 → 1 → 2…), otherwise honour sortOrder param
    const sortDir      = sortField === 'order' ? 1 : (sortOrder === 'asc' ? 1 : -1)

    /* ── Query ── */
    const [forms, total] = await Promise.all([
      Form.find(filter)
        .populate('createdBy',              'name email')
        .populate('moduleId',               'title')
        .sort({ [sortField]: sortDir, order: 1 })
        .skip(skip)
        .limit(limitNum),
      Form.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limitNum)

    return res.status(200).json({
      success: true,
      data: {
        forms,
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
    console.error('[getForms]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   GET /api/forms/:id
   Get a single form by ID (must belong to the CEO's company)
   ════════════════════════════════════════════════════════════ */
async function getForm(req, res) {
  try {
    const form = await Form.findOne({
      _id:       req.params.id,
      companyId: req.user.company,
      isDeleted: false,
    })
      .populate('createdBy',             'name email')
      .populate('moduleId',              'title')
      .populate('sections.assignedBotId','name')

    if (!form) {
      return res.status(404).json({ success: false, message: 'Form not found' })
    }

    return res.status(200).json({ success: true, data: { form } })
  } catch (err) {
    console.error('[getForm]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/forms/:id
   Update a form (CEO only, must own the company)
   ════════════════════════════════════════════════════════════ */
async function updateForm(req, res) {
  try {
    const { name, description, moduleId, sections } = req.body

    const updates = {}
    if (name        !== undefined) updates.name        = name
    if (description !== undefined) updates.description = description
    if (moduleId    !== undefined) updates.moduleId    = moduleId
    if (sections    !== undefined) {
      const valErr = validateImageSections(sections)
      if (valErr) {
        return res.status(400).json({ success: false, message: valErr })
      }
      updates.sections = sections
    }

    const form = await Form.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false },
      updates,
      { new: true, runValidators: true }
    )
      .populate('createdBy',             'name email')
      .populate('moduleId',              'title')
      .populate('sections.assignedBotId','name')

    if (!form) {
      return res.status(404).json({ success: false, message: 'Form not found' })
    }

    return res.status(200).json({ success: true, data: { form } })
  } catch (err) {
    console.error('[updateForm]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   DELETE /api/forms/:id
   Soft-delete: sets isDeleted=true, deletedAt, deletedBy.
   ════════════════════════════════════════════════════════════ */
async function deleteForm(req, res) {
  try {
    const form = await Form.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.company, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
      },
      { new: true }
    )

    if (!form) {
      return res.status(404).json({ success: false, message: 'Form not found or already deleted' })
    }

    return res.status(200).json({ success: true, message: 'Form soft-deleted successfully' })
  } catch (err) {
    console.error('[deleteForm]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


/* ════════════════════════════════════════════════════════════
   PATCH /api/forms/reorder
   Body: { moduleId, orderedIds: [string] }
   Sets order=index for each form ID in the array.
   ════════════════════════════════════════════════════════════ */
async function reorderForms(req, res) {
  try {
    const { moduleId, orderedIds } = req.body

    if (!moduleId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: 'moduleId and orderedIds[] are required' })
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        Form.updateOne(
          { _id: id, moduleId, companyId: req.user.company, isDeleted: false },
          { $set: { order: index } }
        )
      )
    )

    return res.status(200).json({ success: true, message: 'Forms reordered successfully' })
  } catch (err) {
    console.error('[reorderForms]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}


module.exports = { createForm, getForms, getForm, updateForm, deleteForm, reorderForms }
