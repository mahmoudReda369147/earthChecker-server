/**
 * @swagger
 * /api/agents:
 *   get:
 *     summary: Get all agents for your company (paginated)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns agents scoped to the authenticated CEO's company.
 *       Soft-deleted agents are excluded. **Requires role: `ceo`**
 *     parameters:
 *       - { in: query, name: page,      schema: { type: integer, default: 1 },               description: Page number }
 *       - { in: query, name: limit,     schema: { type: integer, default: 10, maximum: 100 }, description: Items per page }
 *       - { in: query, name: search,    schema: { type: string },                             description: Search name or description }
 *       - { in: query, name: sortBy,    schema: { type: string, enum: [createdAt,updatedAt,name,tolerance,like], default: createdAt }, description: Sort field }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc,desc], default: desc }, description: Sort direction }
 *     responses:
 *       200:
 *         description: Paginated agents
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/agents:
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates an agent. Accepts **`multipart/form-data`** so images can be uploaded directly.
 *       `companyId` and `createdBy` are set automatically from the JWT.
 *       **Requires role: `ceo`**
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:          { type: string,  example: VisionCore-v2 }
 *               description:   { type: string,  example: Detects fabric defects }
 *               userPrompt:    { type: string,  example: Inspect every seam carefully }
 *               tolerance:     { type: number,  example: 5, description: "0–100 defect tolerance %" }
 *               image:         { type: string, format: binary, description: Main avatar image }
 *               passImage:     { type: string, format: binary, description: Image shown on pass }
 *               failImage:     { type: string, format: binary, description: Image shown on fail }
 *               thinkingImage: { type: string, format: binary, description: Image shown while processing }
 *     responses:
 *       201:
 *         description: Agent created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/agents/{id}:
 *   get:
 *     summary: Get a single agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns one agent by ID (must belong to the CEO's company).
 *       **Requires role: `ceo`**
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: Agent ObjectId }
 *     responses:
 *       200:
 *         description: Agent found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /api/agents/{id}:
 *   patch:
 *     summary: Update an agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates agent fields. All fields are optional. Accepts **`multipart/form-data`** — any image field
 *       that includes a new file will replace the existing Cloudinary URL.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: Agent ObjectId }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:          { type: string }
 *               description:   { type: string }
 *               userPrompt:    { type: string }
 *               tolerance:     { type: number }
 *               image:         { type: string, format: binary }
 *               passImage:     { type: string, format: binary }
 *               failImage:     { type: string, format: binary }
 *               thinkingImage: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Agent updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /api/agents/{id}:
 *   delete:
 *     summary: Soft-delete an agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Sets `isDeleted=true`, `deletedAt`, `deletedBy`. Agent is hidden from list/get.
 *       **Requires role: `ceo`**
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: Agent ObjectId }
 *     responses:
 *       200:
 *         description: Agent soft-deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Agent soft-deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /api/agents/{id}/like:
 *   patch:
 *     summary: Like an agent (+1)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     description: Increments the agent's `like` counter by 1. Any authenticated user.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Like incremented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:    { type: object, properties: { like: { type: integer, example: 42 } } }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /api/agents/{id}/dislike:
 *   patch:
 *     summary: Dislike an agent (+1)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     description: Increments the agent's `dislike` counter by 1. Any authenticated user.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Dislike incremented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:    { type: object, properties: { dislike: { type: integer, example: 7 } } }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
