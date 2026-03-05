const express = require('express')
const { protect, authorize } = require('../middleware/auth')
const {
  createForm,
  getForms,
  getForm,
  updateForm,
  deleteForm,
  reorderForms,
} = require('../controllers/formController')

const router = express.Router()

/* All form routes require:
   1. Valid access token  (protect)
   2. Role === 'ceo'      (authorize)
*/
router.use(protect)
router.use(authorize('ceo'))

router.route('/')
  .get(getForms)    // GET  /api/forms
  .post(createForm) // POST /api/forms

router.patch('/reorder', reorderForms) // PATCH /api/forms/reorder — must be before /:id

router.route('/:id')
  .get(getForm)      // GET    /api/forms/:id
  .patch(updateForm) // PATCH  /api/forms/:id
  .delete(deleteForm)// DELETE /api/forms/:id

module.exports = router
