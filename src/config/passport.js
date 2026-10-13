const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require("../dto"); 
const jwt = require('jsonwebtoken');
const userDAO = require('../dao/userDAO');
require('dotenv').config();

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: 'http://localhost:3000/auth/google/callback',
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         const email = profile.emails[0].value;
//         if (!email) throw new Error('No email provided by Google');
//         const user = await userDAO.findOrCreateUserByEmail(
//           email,
//           profile.name.givenName,
//           profile.name.familyName
//         );
//         const token = jwt.sign(
//           { id: user.id, email: user.email_id },
//           process.env.JWT_SECRET,
//           { expiresIn: '1h' }
//         );
//         done(null, { user, token });
//       } catch (error) {
//         await addServerLog({
//           log_level: 'ERROR',
//           service_name: 'GoogleStrategy',
//           error_message: Google OAuth error - ${error.message}.,
//         });
//         done(error, null);
//       }
//     }
//   )
// );

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        // Check if user exists
        let user = await User.findOne({ where: { email_id: email } });

        // If not, create a new user (optional)
        if (!user) {
          user = await User.create({
            email_id: email,
            first_name: profile.name.givenName,
            last_name: profile.name.familyName,
            type_id: 1, // adjust as per your default user type
            role_id: 1, // adjust as per your default user role
            status_id: 1,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);


module.exports = passport;