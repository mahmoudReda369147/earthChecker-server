const express = require('express')
const { protect, authorize } = require('../middleware/auth')
const {
  getCycles, createCycle, getCycle, updateCycle, deleteCycle,
  startCycle, pauseCycle, resumeCycle, cancelRequest, cancelCycle,
  rejectCancel, completeCycle,
} = require('../controllers/cycleController')

const router = express.Router()

router.use(protect)

router.route('/')
  .get(getCycles)
  .post(authorize('ceo', 'supervisor'), createCycle)

/* Action routes — must come BEFORE /:id */
router.patch('/:id/start',          authorize('ceo', 'supervisor'), startCycle)
router.patch('/:id/pause',          authorize('ceo', 'supervisor'), pauseCycle)
router.patch('/:id/resume',         authorize('ceo', 'supervisor'), resumeCycle)
router.patch('/:id/cancel-request', authorize('supervisor'),        cancelRequest)
router.patch('/:id/cancel',         authorize('ceo'),               cancelCycle)
router.patch('/:id/reject-cancel',  authorize('ceo'),               rejectCancel)
router.patch('/:id/complete',       authorize('ceo'),               completeCycle)

router.route('/:id')
  .get(getCycle)
  .patch(authorize('ceo', 'supervisor'), updateCycle)
  .delete(authorize('ceo'),             deleteCycle)

module.exports = router
