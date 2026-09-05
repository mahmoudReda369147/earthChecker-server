const mongoose = require('mongoose')

const CompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      unique: true,
      trim: true,
      maxlength: [120, 'Company name must not exceed 120 characters'],
    },

    industry: {
      type: String,
      trim: true,
      default: '',
    },


    address: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    // Set after the CEO user document is created
    ceo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Notification preferences
    notificationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      rejectionAlerts: {
        type: Boolean,
        default: true,
      },
      cycleCompletionAlerts: {
        type: Boolean,
        default: true,
      },
      weeklySummaryReport: {
        type: Boolean,
        default: false,
      },
    },

    // API & Webhook settings
    apiSettings: {
      apiKey: {
        type: String,
        default: '',
      },
      webhookUrl: {
        type: String,
        default: '',
      },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Company', CompanySchema)
