/**
 * @swagger
 * /api/forms:
 *   get:
 *     summary: Get all forms for your company (paginated + filtered)
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns forms that belong to the authenticated CEO's company.
 *       Supports **pagination**, **text search**, **module filter**, and **sorting**.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page (max 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive partial match on name or description
 *         example: quality
 *       - in: query
 *         name: moduleId
 *         schema:
 *           type: string
 *         description: Filter by module ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, order]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Paginated list of forms
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FormListResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — role is not ceo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/forms:
 *   post:
 *     summary: Create a new form
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates a form scoped to the authenticated CEO's company.
 *       `createdBy` and `companyId` are set automatically from the JWT — do not send them in the body.
 *       **Requires role: `ceo`**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, moduleId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Raw Material Inspection Form
 *               description:
 *                 type: string
 *                 example: Form used during incoming raw material inspection
 *               moduleId:
 *                 type: string
 *                 example: 60d0fe4f5311236168a109ca
 *               sections:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/SectionInput'
 *     responses:
 *       201:
 *         description: Form created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FormResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — role is not ceo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/forms/{id}:
 *   get:
 *     summary: Get a single form by ID
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieves one form including its full sections array.
 *       The form must belong to the authenticated CEO's company.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Form ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Form found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FormResponse'
 *       404:
 *         description: Form not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Form not found
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — role is not ceo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/forms/{id}:
 *   patch:
 *     summary: Update a form
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates `name`, `description`, `moduleId`, and/or `sections` of an existing form.
 *       Only provided fields are changed (partial update).
 *       The form must belong to the authenticated CEO's company.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Form ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Form Name
 *               description:
 *                 type: string
 *                 example: Updated description text
 *               moduleId:
 *                 type: string
 *                 example: 60d0fe4f5311236168a109cb
 *               sections:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/SectionInput'
 *     responses:
 *       200:
 *         description: Form updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FormResponse'
 *       404:
 *         description: Form not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — role is not ceo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/forms/reorder:
 *   patch:
 *     summary: Reorder forms within a module
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Sets the `order` field on each form according to its position in `orderedIds`.
 *       The first ID gets `order = 0`, the second `order = 1`, and so on.
 *       Only forms that belong to the authenticated CEO's company and the given module are updated.
 *       **Requires role: `ceo`**
 *       > ⚠️ This route must be called **before** `PATCH /api/forms/:id` in the router
 *       > to avoid Express treating "reorder" as an `:id` parameter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReorderFormsInput'
 *           example:
 *             moduleId: 60d0fe4f5311236168a109ca
 *             orderedIds:
 *               - 60d0fe4f5311236168a109cb
 *               - 60d0fe4f5311236168a109cc
 *               - 60d0fe4f5311236168a109cd
 *     responses:
 *       200:
 *         description: Forms reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Forms reordered successfully
 *       400:
 *         description: Missing or invalid body fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: moduleId and orderedIds[] are required
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — role is not ceo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/forms/{id}:
 *   delete:
 *     summary: Soft-delete a form
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Soft-deletes** a form — the document is kept in the database for audit purposes.
 *       Sets `isDeleted = true`, `deletedAt = now`, `deletedBy = <caller's userId>`.
 *       Soft-deleted forms are **invisible** to `GET /api/forms` and `GET /api/forms/:id`.
 *       The form must belong to the authenticated CEO's company and must not already be deleted.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Form ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Form soft-deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Form soft-deleted successfully
 *       404:
 *         description: Form not found or already deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Form not found or already deleted
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — role is not ceo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
