const express = require('express')
const { protect, authorize } = require('../middleware/auth')
const {
  getStaff,
  createStaff,
  getStaffMember,
  updateStaff,
  deleteStaff,
} = require('../controllers/staffController')

const router = express.Router()

router.use(protect)

router.route('/')
  .get(getStaff)
  .post(authorize('ceo', 'supervisor'), createStaff)

router.route('/:id')
  .get(getStaffMember)
  .patch(authorize('ceo', 'supervisor'), updateStaff)
  .delete(authorize('ceo', 'supervisor'), deleteStaff)

module.exports = router
