const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { protect, registerValidation, loginValidation } = require('../middlewares');

router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/me', protect, authController.getMe);
router.put('/me', protect, authController.updateProfile);
router.put('/password', protect, authController.changePassword);

module.exports = router;