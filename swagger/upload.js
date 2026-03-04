/**
 * @swagger
 * /api/upload/image:
 *   post:
 *     summary: Upload an image to Cloudinary
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Accepts a single image file via `multipart/form-data` field **`image`**.
 *       Uploads it to Cloudinary and returns the `secure_url`.
 *       Maximum file size: **5 MB**. Supported types: JPEG, PNG, WEBP, GIF, SVG.
 *       Use `?folder=modules` (or any folder name) to organise images in Cloudinary.
 *     parameters:
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *           default: uploads
 *         description: Cloudinary folder to store the image in
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG/PNG/WEBP/GIF/SVG, max 5 MB)
 *     responses:
 *       200:
 *         description: Image uploaded
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
 *                     url:       { type: string, example: "https://res.cloudinary.com/demo/image/upload/v1/modules/img.jpg" }
 *                     publicId:  { type: string, example: "modules/1772571107719" }
 *                     width:     { type: integer, example: 800 }
 *                     height:    { type: integer, example: 600 }
 *                     format:    { type: string,  example: "jpg" }
 *       400:
 *         description: No file / unsupported type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: File too large (> 5 MB)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: File too large. Maximum is 5 MB.
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
