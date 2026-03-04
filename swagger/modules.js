/**
 * @swagger
 * /api/modules:
 *   get:
 *     summary: Get all modules for your company (paginated + filtered)
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns modules that belong to the authenticated CEO's company.
 *       Supports **pagination**, **text search**, **creator filter**, and **sorting**.
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
 *         description: Case-insensitive partial match on title or description
 *         example: inspection
 *       - in: query
 *         name: creatorId
 *         schema:
 *           type: string
 *         description: Filter by creator ObjectId
 *         example: 60d0fe4f5311236168a109cc
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, title]
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
 *         description: Paginated list of modules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     modules:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Module'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:      { type: integer, example: 25 }
 *                         totalPages: { type: integer, example: 3  }
 *                         page:       { type: integer, example: 1  }
 *                         limit:      { type: integer, example: 10 }
 *                         hasNext:    { type: boolean, example: true  }
 *                         hasPrev:    { type: boolean, example: false }
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
 *             example:
 *               success: false
 *               message: "Role 'admin' is not allowed to access this resource"
 */

/**
 * @swagger
 * /api/modules:
 *   post:
 *     summary: Create a new module
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates a module scoped to the authenticated CEO's company.
 *       `companyId` and `creatorId` are set automatically from the JWT — do not send them in the body.
 *       **Requires role: `ceo`**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Finished Goods QC
 *               description:
 *                 type: string
 *                 example: Final inspection before shipment
 *               image:
 *                 type: string
 *                 example: https://cdn.example.com/qc-icon.png
 *     responses:
 *       201:
 *         description: Module created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleResponse'
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
 * /api/modules/{id}:
 *   get:
 *     summary: Get a single module by ID
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieves one module. The module must belong to the authenticated CEO's company.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Module found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleResponse'
 *       404:
 *         description: Module not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Module not found
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
 * /api/modules/{id}:
 *   patch:
 *     summary: Update a module
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates `title`, `description`, and/or `image` of an existing module.
 *       The module must belong to the authenticated CEO's company.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Module Title
 *               description:
 *                 type: string
 *                 example: Updated description text
 *               image:
 *                 type: string
 *                 example: https://cdn.example.com/new-icon.png
 *     responses:
 *       200:
 *         description: Module updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleResponse'
 *       404:
 *         description: Module not found
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
 * /api/modules/{id}:
 *   delete:
 *     summary: Soft-delete a module
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Soft-deletes** a module — the document is kept in the database for audit purposes.
 *       Sets `isDeleted = true`, `deletedAt = now`, `deletedBy = <caller's userId>`.
 *       Soft-deleted modules are **invisible** to `GET /api/modules` and `GET /api/modules/:id`.
 *       The module must belong to the authenticated CEO's company and must not already be deleted.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Module soft-deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Module soft-deleted successfully
 *       404:
 *         description: Module not found or already deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Module not found or already deleted
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
