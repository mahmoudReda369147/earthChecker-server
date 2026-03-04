const express = require('express')

const {
  register,
  login,
  verifyEmail,
  resendVerification,
  refreshToken,
  logout,
  logoutAll,
  me,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController')

const { protect } = require('../middleware/auth')
const validate    = require('../middleware/validate')

const {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  resendVerificationRules,
} = require('../validation/auth')

const router = express.Router()

router.post('/register',              registerRules,           validate, register)
router.post('/login',                 loginRules,              validate, login)
router.get( '/verify-email/:token(*)',                                    verifyEmail)
router.post('/resend-verification',   resendVerificationRules, validate, resendVerification)
router.post('/refresh-token',                                            refreshToken)
router.post('/logout',                                                   logout)
router.post('/logout-all',            protect,                           logoutAll)
router.get( '/me',                    protect,                           me)
router.post('/forgot-password',       forgotPasswordRules,     validate, forgotPassword)
router.post('/reset-password/:token', resetPasswordRules,      validate, resetPassword)

module.exports = router
