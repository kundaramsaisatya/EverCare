const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const passport = require("passport");

// ⚠ IMPORTANT: use SAME model (not redefining)
const User = require("mongoose").model("User");

// ------------------
// SIGNUP PAGE
// ------------------
router.get("/signup", (req, res) => {
    res.render("signup");
});

// ------------------
// SIGNUP LOGIC
// ------------------
router.post("/signup", async (req, res) => {
    const { username, email, password, role } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await new User({
        username,
        email,
        password: hashed,
        role
    }).save();

    res.redirect("/login");
});

// ------------------
// LOGIN PAGE
// ------------------
router.get("/login", (req, res) => {
    res.render("login");
});

// ------------------
// LOGIN LOGIC
// ------------------
router.post("/login",
    passport.authenticate("local", {
        successRedirect: "/redirect",
        failureRedirect: "/login"
    })
);

// ------------------
// ROLE REDIRECT
// ------------------
router.get("/redirect", (req, res) => {
    if (req.user.role === "admin") {
        res.redirect("/");
    } else {
        res.redirect("/");
    }
});

// ------------------
// LOGOUT
// ------------------
router.get("/logout", (req, res) => {
    req.logout(() => {
        res.redirect("/login");
    });
});

module.exports = router;