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
      { name: 'Forms',   description: 'Form management — CEO only' },
      { name: 'Staff',   description: 'Staff management — CEO & Supervisor' },
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

        /* ── Forms ── */
        SectionSetting: {
          type: 'object',
          properties: {
            max:    { type: 'number', nullable: true, example: 100  },
            min:    { type: 'number', nullable: true, example: 0    },
            length: { type: 'number', nullable: true, example: 255  },
            size:   { type: 'number', nullable: true, example: 5242880 },
          },
        },
        SectionInput: {
          type: 'object',
          properties: {
            type:         { type: 'string', example: 'text' },
            title:        { type: 'string', example: 'Sample Quality' },
            descriptions: { type: 'string', example: 'Describe the defect if any' },
            options:      { type: 'array', items: { type: 'string' }, example: ['Pass', 'Fail', 'N/A'] },
            assignedBotId: { type: 'string', nullable: true, example: '60d0fe4f5311236168a109cd' },
            isRequired:   { type: 'boolean', example: true },
            setting:      { $ref: '#/components/schemas/SectionSetting' },
          },
        },
        Section: {
          type: 'object',
          properties: {
            _id:          { type: 'string', example: '60d0fe4f5311236168a109ce' },
            type:         { type: 'string', example: 'text' },
            title:        { type: 'string', example: 'Sample Quality' },
            descriptions: { type: 'string', example: 'Describe the defect if any' },
            options:      { type: 'array', items: { type: 'string' }, example: ['Pass', 'Fail', 'N/A'] },
            assignedBotId: {
              type: 'object',
              nullable: true,
              properties: {
                _id:  { type: 'string' },
                name: { type: 'string', example: 'VisionCore-v2' },
              },
            },
            isRequired: { type: 'boolean', example: true },
            setting:    { $ref: '#/components/schemas/SectionSetting' },
          },
        },
        Form: {
          type: 'object',
          properties: {
            _id:         { type: 'string',  example: '60d0fe4f5311236168a109ca' },
            name:        { type: 'string',  example: 'Raw Material Inspection Form' },
            description: { type: 'string',  example: 'Form used during incoming raw material inspection' },
            createdBy: {
              type: 'object',
              properties: {
                _id:   { type: 'string', example: '60d0fe4f5311236168a109cc' },
                name:  { type: 'string', example: 'Ahmad K.' },
                email: { type: 'string', example: 'admin@apex-textile.com' },
              },
            },
            moduleId: {
              type: 'object',
              properties: {
                _id:   { type: 'string', example: '60d0fe4f5311236168a109cb' },
                title: { type: 'string', example: 'Raw Material Inspection' },
              },
            },
            companyId: { type: 'string', example: '60d0fe4f5311236168a109cf' },
            sections:  { type: 'array', items: { $ref: '#/components/schemas/Section' } },
            order:     { type: 'integer', example: 0, description: 'Display order within the module (ascending)' },
            isDeleted: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ReorderFormsInput: {
          type: 'object',
          required: ['moduleId', 'orderedIds'],
          properties: {
            moduleId:   { type: 'string', example: '60d0fe4f5311236168a109ca', description: 'Module ObjectId' },
            orderedIds: {
              type: 'array',
              items: { type: 'string' },
              example: ['60d0fe4f5311236168a109cb', '60d0fe4f5311236168a109cc'],
              description: 'Form IDs in the desired display order (index = new order value)',
            },
          },
        },
        FormResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data:    { type: 'object', properties: { form: { $ref: '#/components/schemas/Form' } } },
          },
        },
        /* ── Staff ── */
        StaffMember: {
          type: 'object',
          properties: {
            _id:             { type: 'string',  example: '60d0fe4f5311236168a109ca' },
            name:            { type: 'string',  example: 'Sarah K.' },
            email:           { type: 'string',  format: 'email', example: 'sarah@apex-textile.com' },
            role:            { type: 'string',  enum: ['ceo', 'supervisor', 'worker'], example: 'supervisor' },
            company:         { type: 'string',  example: '60d0fe4f5311236168a109cb' },
            image:           { type: 'string',  example: 'https://res.cloudinary.com/demo/image/upload/staff.jpg', description: 'Profile photo URL' },
            isEmailVerified: { type: 'boolean', example: true },
            isActive:        { type: 'boolean', example: true },
            lastLoginAt:     { type: 'string',  format: 'date-time', nullable: true },
            createdBy: {
              type: 'object',
              nullable: true,
              properties: {
                _id:  { type: 'string' },
                name: { type: 'string', example: 'Ahmad K.' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateStaffInput: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name:     { type: 'string', example: 'Sarah K.' },
            email:    { type: 'string', format: 'email', example: 'sarah@apex-textile.com' },
            password: { type: 'string', example: 'SecurePass1', description: 'Min 8 characters' },
            role:     { type: 'string', enum: ['ceo', 'supervisor', 'worker'], example: 'supervisor' },
            image:    { type: 'string', example: 'https://res.cloudinary.com/demo/image/upload/staff.jpg', description: 'Profile photo URL from /api/upload/image' },
          },
        },
        StaffResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data:    { type: 'object', properties: { staff: { $ref: '#/components/schemas/StaffMember' } } },
          },
        },
        StaffListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                staff: { type: 'array', items: { $ref: '#/components/schemas/StaffMember' } },
                pagination: {
                  type: 'object',
                  properties: {
                    total:      { type: 'integer', example: 5 },
                    totalPages: { type: 'integer', example: 1 },
                    page:       { type: 'integer', example: 1 },
                    limit:      { type: 'integer', example: 10 },
                    hasNext:    { type: 'boolean', example: false },
                    hasPrev:    { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
        },

        FormListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                forms: { type: 'array', items: { $ref: '#/components/schemas/Form' } },
                pagination: {
                  type: 'object',
                  properties: {
                    total:      { type: 'integer', example: 12 },
                    totalPages: { type: 'integer', example: 2  },
                    page:       { type: 'integer', example: 1  },
                    limit:      { type: 'integer', example: 10 },
                    hasNext:    { type: 'boolean', example: true  },
                    hasPrev:    { type: 'boolean', example: false },
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
