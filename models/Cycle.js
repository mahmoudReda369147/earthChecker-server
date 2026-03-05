const mongoose = require('mongoose')

const CycleSchema = new mongoose.Schema(
  {
    cycleId: {
      type:   String,
      unique: true,
    },

    name: {
      type:      String,
      required:  [true, 'Cycle name is required'],
      trim:      true,
      maxlength: [120, 'Name must not exceed 120 characters'],
    },

    moduleId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Module',
      required: [true, 'Module is required'],
    },

    assignedSupervisor: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Assigned supervisor is required'],
    },

    status: {
      type:    String,
      enum:    ['new', 'inProgress', 'paused', 'cancelledRequest', 'cancelled', 'completed'],
      default: 'new',
    },

    progress: {
      type:    Number,
      default: 0,
      min:     0,
      max:     100,
    },

    pauseMessage: {
      type:    String,
      default: '',
    },

    cancelRequestMessage: {
      type:    String,
      default: '',
    },

    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: [true, 'Company is required'],
    },

    createdBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Creator is required'],
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null   },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

CycleSchema.index({ companyId: 1 })
CycleSchema.index({ assignedSupervisor: 1 })
CycleSchema.index({ status: 1 })

/* Auto-generate cycleId before first save */
CycleSchema.pre('save', async function (next) {
  if (this.cycleId) return next()
  const count = await this.constructor.countDocuments({ companyId: this.companyId })
  this.cycleId = `CYC-${String(count + 1).padStart(4, '0')}`
  next()
})

module.exports = mongoose.model('Cycle', CycleSchema)
