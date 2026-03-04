const jwt = require('jsonwebtoken')

/* ── Access token (short-lived, sent in response body) ── */
function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  })
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET)
}

/* ── Refresh token (long-lived, stored in httpOnly cookie + DB) ── */
function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  })
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
}

/* ── Email verification token (24h, signed — no DB record needed) ── */
function signVerificationToken(userId) {
  return jwt.sign({ id: userId, purpose: 'email_verify' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '24h',
  })
}

function verifyVerificationToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
  if (decoded.purpose !== 'email_verify') {
    throw new Error('Invalid token purpose')
  }
  return decoded
}

/* ── Parse expiry string into milliseconds for cookie maxAge ── */
function parseDurationMs(str = '7d') {
  const unit  = str.slice(-1)
  const value = parseInt(str.slice(0, -1), 10)
  const map   = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return (map[unit] || 86_400_000) * value
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signVerificationToken,
  verifyVerificationToken,
  parseDurationMs,
}
