// --- File: /routes/oauth.js ---
const express = require('express');
const session = require('express-session');
const internalOAuth = require('../internal/oauth');

let router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true
});

router.use(session({
	secret: 'your-secret-key',
	resave: false,
	saveUninitialized: true,
}));

// Initialize Passport.js
router.use(internalOAuth.initialize());
router.use(internalOAuth.session());

// Define OAuth routes
/**
 * /auth/provider
 *
 * Initiate OAuth authentication
 */
router
	.route('/provider')
	.get(internalOAuth.authenticate('oauth2', { session: false }));

/**
 * /auth/provider/callback
 *
 * Handle the OAuth callback
 */
router
	.route('/provider/callback')
	.get(
		internalOAuth.authenticate('oauth2', { failureRedirect: '/' }),
		(req, res) => {
			res.redirect('/auth/profile');
		}
	);

/**
 * Profile route (protected)
 *
 * /auth/profile
 */
router
	.route('/profile')
	.get((req, res) => {
		if (!req.isAuthenticated()) {
			return res.redirect('/');
		}
		res.status(200).send(`Hello, user! Here is your profile: ${JSON.stringify(req.user)}`);
	});

module.exports = router;



