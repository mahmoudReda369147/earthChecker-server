const crypto = require('crypto')
const Company = require('../models/Company')

/* Helper to generate a secure random API key */
function generateApiKey() {
  return 'fb_live_' + crypto.randomBytes(16).toString('hex')
}

/* ════════════════════════════════════════════════════════════
   GET /api/settings  [CEO Only]
   Fetches organization and application settings for company
   ════════════════════════════════════════════════════════════ */
async function getSettings(req, res) {
  try {
    let company = await Company.findById(req.user.company)
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' })
    }

    // Ensure API Key exists
    if (!company.apiSettings || !company.apiSettings.apiKey) {
      if (!company.apiSettings) company.apiSettings = {}
      company.apiSettings.apiKey = generateApiKey()
      await company.save()
    }

    return res.status(200).json({
      success: true,
      data: {
        company,
        ceoEmail: req.user.email,
        ceoName: req.user.name,
      },
    })
  } catch (err) {
    console.error('[getSettings]', err)
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   PUT /api/settings  [CEO Only]
   Updates company details, AI thresholds, notifications & webhooks
   ════════════════════════════════════════════════════════════ */
async function updateSettings(req, res) {
  try {
    const company = await Company.findById(req.user.company)
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' })
    }

    const {
      name,
      industry,
      address,
      phone,
      website,
      notificationSettings,
      apiSettings,
    } = req.body

    if (name !== undefined) company.name = name.trim()
    if (industry !== undefined) company.industry = industry.trim()
    if (address !== undefined) company.address = address.trim()
    if (phone !== undefined) company.phone = phone.trim()
    if (website !== undefined) company.website = website.trim()

    if (notificationSettings) {
      company.notificationSettings = {
        ...company.notificationSettings,
        emailNotifications: notificationSettings.emailNotifications !== undefined ? Boolean(notificationSettings.emailNotifications) : company.notificationSettings?.emailNotifications ?? true,
        rejectionAlerts: notificationSettings.rejectionAlerts !== undefined ? Boolean(notificationSettings.rejectionAlerts) : company.notificationSettings?.rejectionAlerts ?? true,
        cycleCompletionAlerts: notificationSettings.cycleCompletionAlerts !== undefined ? Boolean(notificationSettings.cycleCompletionAlerts) : company.notificationSettings?.cycleCompletionAlerts ?? true,
        weeklySummaryReport: notificationSettings.weeklySummaryReport !== undefined ? Boolean(notificationSettings.weeklySummaryReport) : company.notificationSettings?.weeklySummaryReport ?? false,
      }
    }

    if (apiSettings) {
      company.apiSettings = {
        ...company.apiSettings,
        webhookUrl: apiSettings.webhookUrl !== undefined ? apiSettings.webhookUrl.trim() : company.apiSettings?.webhookUrl ?? '',
      }
    }

    await company.save()

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: { company },
    })
  } catch (err) {
    console.error('[updateSettings]', err)
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   POST /api/settings/rotate-api-key  [CEO Only]
   Generates a new production API key
   ════════════════════════════════════════════════════════════ */
async function rotateApiKey(req, res) {
  try {
    const company = await Company.findById(req.user.company)
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' })
    }

    if (!company.apiSettings) company.apiSettings = {}
    const newKey = generateApiKey()
    company.apiSettings.apiKey = newKey
    await company.save()

    return res.status(200).json({
      success: true,
      message: 'API Key rotated successfully',
      data: { apiKey: newKey },
    })
  } catch (err) {
    console.error('[rotateApiKey]', err)
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message })
  }
}

module.exports = {
  getSettings,
  updateSettings,
  rotateApiKey,
}
