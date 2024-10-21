const passport       = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const axios          = require('axios');
const internalUser   = require('./user');
const log            = require('../logger').express;

// Passport serialization/deserialization
passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});

// Configure OAuth strategy
passport.use(new OAuth2Strategy({
	authorizationURL: 'https://authentik.driverless.fsteamnapier.co.uk/application/o/authorize/',
	tokenURL:         'https://authentik.driverless.fsteamnapier.co.uk/application/o/token/',
	clientID:         'CQeGW5iizE0lJp6Hwi6E3IzlbT9Gkhlex9C2zdTU',
	clientSecret:     'Ya7mTf83ZcdlRyBIeaKgI7hIauZ4fQaoHTtyROzc1zKVxf8RzkisRhoQIYhDFkma7WVMdO3n956YHl9eqfeabxflkxcwBMJfuDYBcSusMdQmn76vph9bCxSZ9u9HurOX',
	callbackURL:      'http://192.168.1.111:3000/auth/provider/callback',
	scope:            ['openid', 'email', 'profile']
},
async (accessToken, refreshToken, profile, done) => {
	try {
		const response = await axios.get('https://authentik.driverless.fsteamnapier.co.uk/application/o/userinfo/', {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
		const userInfo = response.data;
		log.debug(userInfo);

		// Check if the user exists in the database using Objection.js query method
		/*let user = await internalUser.get({
			can:   () => Promise.resolve(true),
			token: {
				getUserId: () => userInfo.id,  // Provide a dummy or actual user ID here
				// Other token methods if necessary...
			}}, { email: userInfo.email}); // Assuming get can be used to find a user by email*/
		let user = false;
		// If the user does not exist, create a new user using internalUser.create
		if (!user) {
			const userData = {
				email:    userInfo.email,
				name:     userInfo.name,
				id:       userInfo.sub,
				nickname: userInfo.nickname,
				roles:    ['admin'] // Set default roles if necessary
			};
			user           = await internalUser.create({
				can:   () => Promise.resolve(true),
				token: {
					getUserId: () => userInfo.sub,  // Provide a dummy or actual user ID here
					// Other token methods if necessary...
				}
			}, userData, true);
		}

		return done(null, user);
	} catch (error) {
		return done(error);
	}
}
));

module.exports = passport;
