const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'interviewiq-secret-key-2024';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional auth — doesn't block if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const foundUser = await User.findById(decoded.userId);
      req.user = foundUser;
      req.userId = foundUser?._id;
    }
  } catch (e) {}
  next();
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = { auth, optionalAuth, generateToken };
