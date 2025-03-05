const User = require('../models/user');

const isAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.is_admin) {
            req.flash('error', 'Access denied. Admin privileges required.');
            return res.redirect('/');
        }
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        req.flash('error', 'An error occurred while checking admin status.');
        res.redirect('/');
    }
};

module.exports = isAdmin; 