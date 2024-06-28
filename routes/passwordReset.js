const express = require('express');
const { requestPasswordReset, verifyCode, resetPassword } = require('../controllers/passwordResetController');

const router = express.Router();

router.post('/request', requestPasswordReset);
router.post('/verify-code', verifyCode);
router.post('/reset', resetPassword);

module.exports = router;
