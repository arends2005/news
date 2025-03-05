const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { isAuthenticated } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');

// Protect all admin routes with both authentication and admin check
router.use(isAuthenticated);
router.use(isAdmin);

// Admin dashboard
router.get('/', async (req, res) => {
    try {
        const users = await User.getAllUsers();
        // Sort users: admins first, then by username
        const sortedUsers = users.sort((a, b) => {
            if (a.is_admin && !b.is_admin) return -1;
            if (!a.is_admin && b.is_admin) return 1;
            return a.username.localeCompare(b.username);
        });

        // Get current bot user ID from settings
        const botUserResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['bot_user_id']);
        const currentBotUserId = botUserResult.rows.length > 0 ? parseInt(botUserResult.rows[0].value) : 1;
        
        res.render('admin/dashboard', { 
            title: 'Admin Dashboard',
            users: sortedUsers,
            currentBotUserId,
            layout: false // Disable layout for admin dashboard
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        req.flash('error', 'Failed to load admin dashboard');
        res.redirect('/');
    }
});

// Update admin's own password
router.post('/update-password', isAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            req.flash('error', 'Both current and new passwords are required');
            return res.redirect('/admin');
        }
        
        await User.updatePassword(req.user.id, currentPassword, newPassword);
        req.flash('success', 'Password updated successfully');
        res.redirect('/admin');
    } catch (error) {
        console.error('Update password error:', error);
        req.flash('error', error.message || 'Failed to update password');
        res.redirect('/admin');
    }
});

// Delete user
router.post('/users/:id/delete', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Prevent admin from deleting themselves
        if (userId === req.session.userId) {
            req.flash('error', 'Cannot delete your own admin account');
            return res.redirect('/admin');
        }
        
        await User.deleteUser(userId);
        req.flash('success', 'User deleted successfully');
        res.redirect('/admin');
    } catch (error) {
        console.error('Delete user error:', error);
        req.flash('error', 'Failed to delete user');
        res.redirect('/admin');
    }
});

// Reset user password
router.post('/users/:id/reset-password', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { newPassword } = req.body;
        
        if (!newPassword) {
            req.flash('error', 'New password is required');
            return res.redirect('/admin');
        }
        
        await User.resetPassword(userId, newPassword);
        req.flash('success', 'Password reset successfully');
        res.redirect('/admin');
    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error', 'Failed to reset password');
        res.redirect('/admin');
    }
});

// Toggle admin status
router.post('/users/:id/toggle-admin', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Prevent admin from removing their own admin status
        if (userId === req.session.userId) {
            req.flash('error', 'Cannot modify your own admin status');
            return res.redirect('/admin');
        }
        
        const user = await User.toggleAdmin(userId);
        req.flash('success', `Admin status ${user.is_admin ? 'granted' : 'removed'} successfully`);
        res.redirect('/admin');
    } catch (error) {
        console.error('Toggle admin error:', error);
        req.flash('error', 'Failed to toggle admin status');
        res.redirect('/admin');
    }
});

// Update bot user ID
router.post('/update-bot-user', isAdmin, async (req, res) => {
    try {
        const { botUserId } = req.body;
        
        if (!botUserId) {
            req.flash('error', 'Bot user ID is required');
            return res.redirect('/admin');
        }

        // Verify the user exists
        const user = await User.findById(botUserId);
        if (!user) {
            req.flash('error', 'Selected user not found');
            return res.redirect('/admin');
        }
        
        // Update the setting in the database
        await pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
            ['bot_user_id', botUserId]
        );
        
        // Update the bot's system user ID
        const bot = require('../discord/bot');
        await bot.getSystemUserId();
        
        req.flash('success', 'Bot user updated successfully');
        res.redirect('/admin');
    } catch (error) {
        console.error('Update bot user error:', error);
        req.flash('error', error.message || 'Failed to update bot user');
        res.redirect('/admin');
    }
});

module.exports = router; 