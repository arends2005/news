const isAuthenticated = (req, res, next) => {
    if (req.user) {
        return next();
    }
    res.redirect('/auth/login');
};

const isGuest = (req, res, next) => {
    if (!req.user) {
        return next();
    }
    res.redirect('/');
};

module.exports = {
    isAuthenticated,
    isGuest
}; 