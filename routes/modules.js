const express = require('express')
const { protect, authorize } = require('../middleware/auth')
const {
  createModule,
  getModules,
  getModule,
  updateModule,
  deleteModule,
} = require('../controllers/moduleController')

const router = express.Router()

/* All module routes require:
   1. Valid access token  (protect)
   2. Role === 'ceo'      (authorize)
*/
router.use(protect)
router.use(authorize('ceo'))

router.route('/')
  .get(getModules)     // GET  /api/modules
  .post(createModule)  // POST /api/modules

router.route('/:id')
  .get(getModule)      // GET    /api/modules/:id
  .patch(updateModule) // PATCH  /api/modules/:id
  .delete(deleteModule)// DELETE /api/modules/:id

module.exports = router
