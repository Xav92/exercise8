import express from "express";
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { createUser, getUserById } from '../db.js';
import { createClient } from "redis";

const router = express.Router();

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.connect().catch(console.error);

// Configure Passport
passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:3000/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await getUserById(profile.id);
          if (!user) {
            createUser(profile);
            user = {
              id: profile.id,
              displayName: profile.displayName,
              name: profile.name
            };
          }
          // Store only user ID in Redis
          await redisClient.setEx(profile.id, 3600, profile.id);

          return done(null, profile);
        } catch (err) {
          return done(err);
        }
      }
    )
);

// // Serialize user into session (store only user ID)
// passport.serializeUser((user, done) => {
//   done(null, user.id); // Store the user ID
// });

// // Deserialize user from session (fetch user by ID from MongoDB)
// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await getUserById(id);
//     done(null, user);
//   } catch (err) {
//     done(err, null);
//   }
// });

// Serialize user into session (store only user ID in session)
passport.serializeUser((user, done) => {
  done(null, user.id); // Store the user ID in the session
});

//Deserialize user from session (fetch user by ID from Redis)
passport.deserializeUser(async (id, done) => {
  try {
    const userData = await redisClient.get(id);
    if (userData) {
      const user = JSON.parse(userData);
      done(null, user);
    } else {
      done(null, null); // User not found in Redis
    }
  } catch (err) {
    done(err, null);
  }
});


// Initialize Passport and restore authentication state from session
router.use(passport.initialize());
router.use(passport.session());

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { 
    title: "Yay node!",
    user: req.user
  });
});

// Route to display login link if not authenticated
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.send(`Hello ${req.user.displayName} <a href="/logout">Logout</a>`);
  } else {
    res.send('<a href="/auth/google">Hello Anonymous</a>');
  }
});

// Google OAuth routes
router.get('/auth/google', (req, res, next) => {
  passport.authenticate('google', { scope: ['profile'], prompt: 'select_account' })(req, res, next);
});

// Callback route for Google to redirect 
router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/profile');
  }
);

// Display the profile
router.get('/profile', (req, res) => {
  if (req.isAuthenticated()) {
    res.send(`Hello ${req.user.displayName}<br> <a href="/logout">Logout</a>`);
  } else {
    res.redirect('/');
  }
});

// Logout route
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });
});

//Route to print sessions stored in Redis
router.get("/print-sessions", (req, res) => {
  const sessionStore = req.sessionStore;
  sessionStore.all((err, sessions) => {
    if (err) {
      console.error("Error fetching sessions:", err);
      res.status(500).send("Failed to fetch sessions");
      return;
    }
    res.send(sessions);
  });
});

export default router;
