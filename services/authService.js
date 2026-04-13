const jwt = require('jsonwebtoken');
const { UserRepository } = require('../repositories');

class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });
  }

  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  async register(userData) {
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    const user = await this.userRepository.create(userData);
    const token = this.generateToken(user._id);

    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      token
    };
  }

  async login(email, password) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.userRepository.updateById(user._id, { lastLogin: new Date() });

    const token = this.generateToken(user._id);

    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      token
    };
  }

  async getProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateProfile(userId, updateData) {
    // Don't allow password update through this method
    delete updateData.password;
    
    const user = await this.userRepository.updateById(userId, updateData);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.userRepository.findById(userId).select('+password');
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    return { message: 'Password updated successfully' };
  }
}

module.exports = new AuthService();