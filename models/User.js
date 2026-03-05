const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name must not exceed 80 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries by default
    },

    role: {
      type: String,
      enum: ['ceo', 'supervisor', 'worker'],
      default: 'worker',
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    image: {
      type: String,
      default: '',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
  }
)

/* ── Hash password before saving ── */
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

/* ── Instance method: compare plain password ── */
UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password)
}

/* ── Instance method: safe public projection ── */
UserSchema.methods.toPublic = function () {
  return {
    id:              this._id,
    name:            this.name,
    email:           this.email,
    role:            this.role,
    company:         this.company,
    isEmailVerified: this.isEmailVerified,
    isActive:        this.isActive,
    lastLoginAt:     this.lastLoginAt,
    createdAt:       this.createdAt,
  }
}

module.exports = mongoose.model('User', UserSchema)
