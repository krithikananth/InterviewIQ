const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

// Register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = new User({ name, email: email.toLowerCase(), password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ user: user.toJSON(), token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user._id);
    res.json({ user: user.toJSON(), token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current user
const getMe = async (req, res) => {
  res.json({ user: req.user.toJSON() });
};

module.exports = { register, login, getMe };
