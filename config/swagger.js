const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Feedbrush API',
      version: '1.0.0',
      description: `
## EarthChecker — Quality Inspection Platform API

Authentication system with access/refresh token rotation, Gmail password reset, and role-based authorization.

### Auth flow
1. **Register** or **Login** → receive \`accessToken\` (body) + \`refreshToken\` (httpOnly cookie)
2. Attach \`Bearer <accessToken>\` to protected requests
3. When access token expires → call \`/refresh-token\` (cookie auto-sent)
4. **Logout** revokes the current session; **Logout-all** revokes every session
      `,
      contact: { name: 'Feedbrush Team' },
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development' },
    ],
    tags: [
      { name: 'Auth',    description: 'Authentication & session management' },
      { name: 'Modules', description: 'Module management — CEO only' },
      { name: 'Agents',  description: 'AI Agent management — CEO only (like/dislike open to all)' },
      { name: 'Upload',  description: 'Cloudinary image upload' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token returned by login/register (expires in 15 min)',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'httpOnly refresh-token cookie — sent automatically by the browser',
        },
      },
      schemas: {
        /* ── Reusable models ── */
        User: {
          type: 'object',
          properties: {
            id:           { type: 'string',  example: '60d0fe4f5311236168a109ca' },
            name:         { type: 'string',  example: 'Ahmad K.' },
            email:        { type: 'string',  format: 'email', example: 'admin@apex-textile.com' },
            role:         { type: 'string',  enum: ['admin', 'supervisor', 'worker'], example: 'admin' },
            organization: { type: 'string',  example: 'Apex Textile Group' },
            isEmailVerified: { type: 'boolean', example: true },
            isActive:        { type: 'boolean', example: true },
            lastLoginAt:  { type: 'string',  format: 'date-time', nullable: true },
            createdAt:    { type: 'string',  format: 'date-time' },
          },
        },
        AuthData: {
          type: 'object',
          properties: {
            user:        { $ref: '#/components/schemas/User' },
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string',  example: 'Operation successful' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string',  example: 'Error description' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string',  example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field:   { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Enter a valid email' },
                },
              },
            },
          },
        },
        Module: {
          type: 'object',
          properties: {
            _id:         { type: 'string',  example: '60d0fe4f5311236168a109ca' },
            title:       { type: 'string',  example: 'Raw Material Inspection' },
            description: { type: 'string',  example: 'Inspection module for incoming raw materials' },
            companyId:   { type: 'string',  example: '60d0fe4f5311236168a109cb' },
            creatorId: {
              type: 'object',
              properties: {
                _id:   { type: 'string', example: '60d0fe4f5311236168a109cc' },
                name:  { type: 'string', example: 'Ahmad K.' },
                email: { type: 'string', example: 'admin@apex-textile.com' },
              },
            },
            image:     { type: 'string',  example: 'https://cdn.example.com/module.png' },
            createdAt: { type: 'string',  format: 'date-time' },
            updatedAt: { type: 'string',  format: 'date-time' },
          },
        },
        ModuleListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                modules: { type: 'array', items: { $ref: '#/components/schemas/Module' } },
                total:   { type: 'integer', example: 3 },
              },
            },
          },
        },
        ModuleResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                module: { $ref: '#/components/schemas/Module' },
              },
            },
          },
        },
        Agent: {
          type: 'object',
          properties: {
            _id:           { type: 'string' },
            name:          { type: 'string',  example: 'VisionCore-v2' },
            description:   { type: 'string' },
            userPrompt:    { type: 'string' },
            tolerance:     { type: 'number',  example: 5 },
            image:         { type: 'string',  example: 'https://res.cloudinary.com/demo/image/upload/agent.jpg' },
            passImage:     { type: 'string' },
            failImage:     { type: 'string' },
            thinkingImage: { type: 'string' },
            companyId:     { type: 'string' },
            createdBy: {
              type: 'object',
              properties: {
                _id:   { type: 'string' },
                name:  { type: 'string', example: 'Ahmad K.' },
                email: { type: 'string', example: 'admin@apex.com' },
              },
            },
            like:      { type: 'integer', example: 12 },
            dislike:   { type: 'integer', example: 2  },
            isDeleted: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AgentResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data:    { type: 'object', properties: { agent: { $ref: '#/components/schemas/Agent' } } },
          },
        },
        AgentListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                agents:     { type: 'array', items: { $ref: '#/components/schemas/Agent' } },
                pagination: {
                  type: 'object',
                  properties: {
                    total:      { type: 'integer' },
                    totalPages: { type: 'integer' },
                    page:       { type: 'integer' },
                    limit:      { type: 'integer' },
                    hasNext:    { type: 'boolean' },
                    hasPrev:    { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid access token',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        Forbidden: {
          description: "Role not allowed",
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { success: false, message: "Role 'admin' is not allowed" } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { success: false, message: 'Not found' } } },
        },
      },
    },
  },
  apis: ['./swagger/*.js'], // swagger-jsdoc reads @swagger comments from here
}

module.exports = swaggerJsdoc(options)
