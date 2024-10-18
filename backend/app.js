const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const compression = require('compression');
const config = require('./lib/config');
const log = require('./logger').express;
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;

/**
 * App
 */
const app = express();
app.use(fileUpload());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Gzip
app.use(compression());

/**
 * General Logging, BEFORE routes
 */

app.disable('x-powered-by');
app.enable('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
app.enable('strict routing');

// Use the actual Authentik credentials for testing
const AUTHENTIK_CLIENT_ID = 'YOUR_AUTHENTIK_CLIENT_ID';
const AUTHENTIK_CLIENT_SECRET = 'YOUR_AUTHENTIK_CLIENT_SECRET';
const AUTHENTIK_AUTHORIZATION_URL = 'https://your-authentik-instance.example.com/application/o/authorize/';
const AUTHENTIK_TOKEN_URL = 'https://your-authentik-instance.example.com/application/o/token/';
const AUTHENTIK_CALLBACK_URL = 'http://localhost:3000/auth/authentik/callback';

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Authentik OAuth2 Strategy
passport.use(new OAuth2Strategy({
        authorizationURL: AUTHENTIK_AUTHORIZATION_URL,
        tokenURL: AUTHENTIK_TOKEN_URL,
        clientID: AUTHENTIK_CLIENT_ID,
        clientSecret: AUTHENTIK_CLIENT_SECRET,
        callbackURL: AUTHENTIK_CALLBACK_URL
    },
    function (accessToken, refreshToken, profile, done) {
        // For simplicity, we're using accessToken for user identification here.
        // Proper implementation should involve fetching the user profile from Authentik using accessToken.
        return done(null, {accessToken, profile});
    }
));

// Passport Serialization
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});


// pretty print JSON when not live
if (config.debug()) {
    app.set('json spaces', 2);
}

// CORS for everything
app.use(require('./lib/express/cors'));

// General security/cache related headers + server header
app.use(function (req, res, next) {
    let x_frame_options = 'DENY';

    if (typeof process.env.X_FRAME_OPTIONS !== 'undefined' && process.env.X_FRAME_OPTIONS) {
        x_frame_options = process.env.X_FRAME_OPTIONS;
    }

    res.set({
        'X-XSS-Protection': '1; mode=block',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': x_frame_options,
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: 0
    });
    next();
});

app.use(require('./lib/express/jwt')());
app.use('/', require('./routes/main'));

// production error handler
// no stacktraces leaked to user
// eslint-disable-next-line
app.use(function (err, req, res, next) {

    let payload = {
        error: {
            code: err.status,
            message: err.public ? err.message : 'Internal Error'
        }
    };

    if (config.debug() || (req.baseUrl + req.path).includes('nginx/certificates')) {
        payload.debug = {
            stack: typeof err.stack !== 'undefined' && err.stack ? err.stack.split('\n') : null,
            previous: err.previous
        };
    }

    // Not every error is worth logging - but this is good for now until it gets annoying.
    if (typeof err.stack !== 'undefined' && err.stack) {
        if (config.debug()) {
            log.debug(err.stack);
        } else if (typeof err.public == 'undefined' || !err.public) {
            log.warn(err.message);
        }
    }

    res
        .status(err.status || 500)
        .send(payload);
});

module.exports = app;
