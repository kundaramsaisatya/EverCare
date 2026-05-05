module.exports = {
    isAuth: (req, res, next) => {
        if (req.isAuthenticated()) return next();
        res.redirect("/login");
    },

    isAdmin: (req, res, next) => {
        if (req.user && req.user.role === "admin") return next();
        res.send("Access Denied");
    }
};