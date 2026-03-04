const crypto             = require('crypto')
const User               = require('../models/User')
const RefreshToken       = require('../models/RefreshToken')
const PasswordResetToken = require('../models/PasswordResetToken')
const Company            = require('../models/Company')
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/email')
const {
  signAccessToken,
  signRefreshToken,
  signVerificationToken,
  verifyVerificationToken,
  verifyRefreshToken,
  parseDurationMs,
} = require('../utils/jwt')
/* ── Helper: set httpOnly refresh-token cookie ── */
function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   parseDurationMs(process.env.JWT_REFRESH_EXPIRES || '7d'),
    path:     '/api/auth',
  })
}

/* ── Helper: compute expiry Date for RefreshToken document ── */
function refreshExpiryDate() {
  return new Date(Date.now() + parseDurationMs(process.env.JWT_REFRESH_EXPIRES || '7d'))
}

/* ── Helper: SHA-256 hash a raw token ── */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/* ── Helper: create + send an email verification token (JWT-based) ── */
async function issueVerificationEmail(user) {
  // Sign a short-lived JWT — no DB record needed, no hash-mismatch possible
  const token     = signVerificationToken(user._id)
  const verifyUrl = `${process.env.CLIENT_ORIGIN}/verify-email/${token}`
  await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl })
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/register
   Body: { name, email, password, role?, organization? }
   Creates account, sends verification email. No tokens issued
   until the email is verified.
   ════════════════════════════════════════════════════════════ */
async function register(req, res) {
  try {
    const { name, email, password, company } = req.body

    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' })
    }
    const createdCompany = await Company.create({ ...company })

    const user = await User.create({ name, email, password, role: 'ceo', company: createdCompany._id })
    createdCompany.ceo = user._id
    await createdCompany.save()

    await issueVerificationEmail(user)

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    console.error('[register]', err)
    return res.status(500).json({ success: false, message: 'Server error'+ err.message })
  }
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/login
   Body: { email, password }
   Blocks login until email is verified.
   ════════════════════════════════════════════════════════════ */
async function login(req, res) {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password').populate('company')
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' })
    }

    const match = await user.comparePassword(password)
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox or request a new verification link.',
        code: 'EMAIL_NOT_VERIFIED',
      })
    }

    user.lastLoginAt = new Date()
    await user.save()

    const accessToken  = signAccessToken({ id: user._id, role: user.role })
    const refreshToken = signRefreshToken({ id: user._id })

    await RefreshToken.create({
      token:     refreshToken,
      user:      user._id,
      expiresAt: refreshExpiryDate(),
      userAgent: req.headers['user-agent'] || '',
      ip:        req.ip,
    })

    setRefreshCookie(res, refreshToken)

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: user.toPublic(), accessToken },
    })
  } catch (err) {
    console.error('[login]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/auth/verify-email/:token
   Verifies the email address and activates the account.
   ════════════════════════════════════════════════════════════ */
async function verifyEmail(req, res) {
  try {
    const { token } = req.params

    // Verify JWT signature + expiry (no DB lookup, no hash-mismatch possible)
    let decoded
    try {
      decoded = verifyVerificationToken(token)
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Verification link is invalid or has expired.',
      })
    }

    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found.' })
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified. You can log in.',
      })
    }

    user.isEmailVerified = true
    await user.save()

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    })
  } catch (err) {
    console.error('[verifyEmail]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/resend-verification
   Body: { email }
   Always returns 200 — prevents email enumeration.
   ════════════════════════════════════════════════════════════ */
async function resendVerification(req, res) {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })

    // Respond identically whether the email exists or is already verified
    if (!user || user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'If that email is registered and unverified, a new verification link has been sent.',
      })
    }

    await issueVerificationEmail(user)

    return res.status(200).json({
      success: true,
      message: 'If that email is registered and unverified, a new verification link has been sent.',
    })
  } catch (err) {
    console.error('[resendVerification]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/refresh-token
   Cookie: refreshToken — rotates tokens, issues new access token.
   ════════════════════════════════════════════════════════════ */
async function refreshToken(req, res) {
  try {
    const incoming = req.cookies?.refreshToken
    if (!incoming) {
      return res.status(401).json({ success: false, message: 'No refresh token' })
    }

    let decoded
    try {
      decoded = verifyRefreshToken(incoming)
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' })
    }

    const stored = await RefreshToken.findOne({ token: incoming })
    if (!stored) {
      await RefreshToken.deleteMany({ user: decoded.id })
      return res.status(401).json({
        success: false,
        message: 'Refresh token reuse detected — all sessions revoked',
      })
    }

    const user = await User.findById(decoded.id)
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' })
    }

    await RefreshToken.deleteOne({ _id: stored._id })

    const newAccessToken  = signAccessToken({ id: user._id, role: user.role })
    const newRefreshToken = signRefreshToken({ id: user._id })

    await RefreshToken.create({
      token:     newRefreshToken,
      user:      user._id,
      expiresAt: refreshExpiryDate(),
      userAgent: req.headers['user-agent'] || '',
      ip:        req.ip,
    })

    setRefreshCookie(res, newRefreshToken)

    return res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken },
    })
  } catch (err) {
    console.error('[refreshToken]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/logout
   ════════════════════════════════════════════════════════════ */
async function logout(req, res) {
  try {
    const token = req.cookies?.refreshToken
    if (token) await RefreshToken.deleteOne({ token })
    res.clearCookie('refreshToken', { path: '/api/auth' })
    return res.status(200).json({ success: true, message: 'Logged out successfully' })
  } catch (err) {
    console.error('[logout]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/logout-all  [protected]
   ════════════════════════════════════════════════════════════ */
async function logoutAll(req, res) {
  try {
    await RefreshToken.deleteMany({ user: req.user._id })
    res.clearCookie('refreshToken', { path: '/api/auth' })
    return res.status(200).json({ success: true, message: 'All sessions revoked' })
  } catch (err) {
    console.error('[logoutAll]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/auth/me  [protected]
   ════════════════════════════════════════════════════════════ */
async function me(req, res) {
  return res.status(200).json({
    success: true,
    data: { user: await req.user.populate('company') },
  })
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password
   Body: { email }
   Always returns 200 — prevents email enumeration.
   ════════════════════════════════════════════════════════════ */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email is registered, a password reset link has been sent.',
      })
    }

    await PasswordResetToken.deleteMany({ user: user._id })

    const rawToken    = crypto.randomBytes(32).toString('hex')
    const hashedToken = hashToken(rawToken)

    await PasswordResetToken.create({
      token:     hashedToken,
      user:      user._id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    })

    const resetUrl = `${process.env.CLIENT_ORIGIN}/reset-password/${rawToken}`
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl })

    return res.status(200).json({
      success: true,
      message: 'If that email is registered, a password reset link has been sent.',
    })
  } catch (err) {
    console.error('[forgotPassword]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/reset-password/:token
   Body: { password }
   ════════════════════════════════════════════════════════════ */
async function resetPassword(req, res) {
  try {
    const { token } = req.params
    const { password } = req.body

    const hashedToken = hashToken(token)
    const record = await PasswordResetToken.findOne({
      token:     hashedToken,
      expiresAt: { $gt: new Date() },
    })

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired.',
      })
    }

    const user = await User.findById(record.user)
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found.' })
    }

    user.password = password
    await user.save()

    await PasswordResetToken.deleteOne({ _id: record._id })
    await RefreshToken.deleteMany({ user: user._id })
    res.clearCookie('refreshToken', { path: '/api/auth' })

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    })
  } catch (err) {
    console.error('[resetPassword]', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

module.exports = {
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
}
