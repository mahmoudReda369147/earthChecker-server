/**
 * @swagger
 * /api/staff:
 *   get:
 *     summary: List all staff in your company
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns all users belonging to the authenticated user's company, **excluding the caller**.
 *       Supports pagination, text search (name / email), and role filter.
 *       **Requires authentication** (any role).
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 100 }
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive partial match on name or email
 *         example: Ahmad
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ceo, supervisor, worker]
 *         description: Filter by role
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, role]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Paginated list of staff members
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffListResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/staff:
 *   post:
 *     summary: Create a new staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates a new user in the same company as the caller.
 *       The new account is **immediately active** — no email verification needed.
 *       The caller can only assign roles **equal to or lower** than their own.
 *
 *       | Caller role  | Allowed target roles         |
 *       |---|---|
 *       | `ceo`        | ceo, supervisor, worker      |
 *       | `supervisor` | supervisor, worker           |
 *       | `worker`     | ❌ not allowed (403)         |
 *
 *       **Requires role: `ceo` or `supervisor`**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStaffInput'
 *           example:
 *             name: Sarah K.
 *             email: sarah@apex-textile.com
 *             password: SecurePass1
 *             role: supervisor
 *     responses:
 *       201:
 *         description: Staff member created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffResponse'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — target role exceeds caller's role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "You cannot create a user with role 'ceo' — it exceeds your own role"
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: A user with this email already exists
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/staff/{id}:
 *   get:
 *     summary: Get a single staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns a single user who belongs to the authenticated user's company.
 *       **Requires authentication** (any role).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: User ObjectId
 *         example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Staff member found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffResponse'
 *       404:
 *         description: Staff member not found
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
 */

/**
 * @swagger
 * /api/staff/{id}:
 *   patch:
 *     summary: Update a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates `name`, `role`, and/or `isActive` of a staff member.
 *       Guards:
 *       - Cannot edit your own account via this endpoint
 *       - Cannot edit a member whose role outranks yours
 *       - Cannot assign a role higher than your own
 *
 *       **Requires role: `ceo` or `supervisor`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: User ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sarah K. Updated
 *               role:
 *                 type: string
 *                 enum: [ceo, supervisor, worker]
 *                 example: worker
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Staff member updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffResponse'
 *       400:
 *         description: Cannot edit self or invalid role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Role hierarchy violation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Staff member not found
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
 */

/**
 * @swagger
 * /api/staff/{id}:
 *   delete:
 *     summary: Deactivate a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Sets `isActive = false` on the target user (soft deactivation — account is kept in DB).
 *       The deactivated user will be blocked from logging in.
 *       Guards:
 *       - Cannot deactivate yourself
 *       - Cannot deactivate a member whose role outranks yours
 *
 *       **Requires role: `ceo` or `supervisor`**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: User ObjectId
 *     responses:
 *       200:
 *         description: Staff member deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Staff member deactivated
 *       400:
 *         description: Cannot deactivate self
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Role hierarchy violation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Staff member not found
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
 */
