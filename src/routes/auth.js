const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { isGuest } = require('../middleware/auth');
const passport = require('passport');

// Login page
router.get('/login', isGuest, async (req, res) => {
  try {
    const userCount = await User.getUserCount();
    console.log('Rendering login page with user count:', userCount);
    res.render('auth/login', { title: 'Login', userCount });
  } catch (error) {
    console.error('Error getting user count:', error);
    res.render('auth/login', { title: 'Login', userCount: 0 });
  }
});

// Register page
router.get('/register', isGuest, async (req, res) => {
  try {
    const userCount = await User.getUserCount();
    console.log('Rendering register page with user count:', userCount);
    res.render('auth/register', { title: 'Register', userCount });
  } catch (error) {
    console.error('Error getting user count:', error);
    res.render('auth/register', { title: 'Register', userCount: 0 });
  }
});

// Login handler
router.post('/login', isGuest, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return next(err);
    }
    if (!user) {
      console.log('Authentication failed:', info.message);
      req.flash('error', info.message);
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      console.log('Login successful:', user.username);
      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return next(err);
        }
        return res.redirect('/');
      });
    });
  })(req, res, next);
});

// Register handler
router.post('/register', isGuest, async (req, res) => {
  try {
    const { username, email, password, inviteCode } = req.body;
    console.log('Registration attempt for:', { username, email });
    
    // Validate invite code
    if (inviteCode !== process.env.INVITE_CODE) {
      console.log('Invalid invite code');
      req.flash('error', 'Invalid invite code');
      return res.redirect('/auth/register');
    }
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log('User already exists');
      req.flash('error', 'Email already registered');
      return res.redirect('/auth/register');
    }

    // Create new user
    const user = await User.create({ username, email, password });
    
    // Log the user in using Passport
    req.logIn(user, (err) => {
      if (err) {
        console.error('Error logging in after registration:', err);
        return res.redirect('/auth/login');
      }
      console.log('Registration and login successful:', user.username);
      res.redirect('/');
    });
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'An error occurred during registration');
    res.redirect('/auth/register');
  }
});

// Logout handler
router.get('/logout', (req, res) => {
  console.log('User logging out:', req.user?.username);
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/auth/login');
  });
});

// Update dark mode preference
router.post('/dark-mode', async (req, res) => {
  try {
    if (!req.session.userId) {
      console.log('No user in session for dark mode update');
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { darkMode } = req.body;
    console.log('Updating dark mode for user:', req.session.userId, 'to:', darkMode);
    
    const user = await User.updateDarkMode(req.session.userId, darkMode);
    
    // Update session data
    req.session.darkMode = user.dark_mode;
    
    // Save the session explicitly
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          reject(err);
        } else {
          console.log('Session saved with dark mode:', user.dark_mode);
          resolve();
        }
      });
    });
    
    console.log('Dark mode updated successfully:', user.dark_mode);
    res.json({ success: true, darkMode: user.dark_mode });
  } catch (error) {
    console.error('Error updating dark mode:', error);
    res.status(500).json({ success: false, error: 'Failed to update dark mode' });
  }
});

module.exports = router; 