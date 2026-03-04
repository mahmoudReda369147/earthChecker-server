const { verifyAccessToken } = require('../utils/jwt')
const User = require('../models/User')

/**
 * Protect routes — verifies Bearer access token in Authorization header.
 * Attaches `req.user` on success.
 */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' })
    }

    const token = header.split(' ')[1]
    const decoded = verifyAccessToken(token)

    // Fetch fresh user (catches deactivated accounts mid-session)
    const user = await User.findById(decoded.id).select('-password')
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' })
    }

    req.user = user
    next()
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Token expired'
      : err.name === 'JsonWebTokenError' ? 'Invalid token'
      : 'Authentication failed'

    return res.status(401).json({ success: false, message })
  }
}

/**
 * Role guard — call after `protect`.
 * Usage: authorize('admin', 'supervisor')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not allowed to access this resource`,
      })
    }
    next()
  }
}

module.exports = { protect, authorize }
