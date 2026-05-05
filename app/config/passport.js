const LocalStrategy = require('passport-local').Strategy;
const mongoose = require("mongoose");
const User = mongoose.model("User");
const bcrypt = require('bcrypt');

function init(passport) {
    passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
        try {
            //Login
            // Check if email exists
            const user = await User.findOne({ email: email });
            if (!user) {
                return done(null, false, { message: 'No user with this email' });
            }

            // Compare password
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                return done(null, user, { message: 'Logged in successfully' });
            } else {
                return done(null, false, { message: 'Wrong username or password' });
            }
        } catch (err) {
            return done(err);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user._id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
}

module.exports = init;