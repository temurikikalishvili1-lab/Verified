const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
// Load env from ../config/env.local first, then ../config/.env if present.
['env.local', '.env'].forEach((file) => {
    const fullPath = path.join(__dirname, '..', 'config', file);
    if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath });
    }
});
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { db, createUser, getUserByEmail, getUserById } = require('./database');

const app = express();
const PORT = process.env.PORT || 4000;

// Currency / provider configuration
const DEFAULT_CURRENCY = (process.env.CURRENCY || 'GEL').toUpperCase();
const BOG_CURRENCY = (process.env.BOG_CURRENCY || DEFAULT_CURRENCY).toUpperCase();
const WOOPAY_CURRENCY = (process.env.WOOPAY_CURRENCY || DEFAULT_CURRENCY).toUpperCase();
const CURRENCY = DEFAULT_CURRENCY;
const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || 'bog').toLowerCase();

// Bank of Georgia hosted checkout configuration (placeholders)
const BOG_GATEWAY_URL = process.env.BOG_GATEWAY_URL || '';
const BOG_MERCHANT_ID = process.env.BOG_MERCHANT_ID || '';
const BOG_TERMINAL_ID = process.env.BOG_TERMINAL_ID || '';
const BOG_SECRET_KEY = process.env.BOG_SECRET_KEY || '';
const BOG_CALLBACK_URL = process.env.BOG_CALLBACK_URL;
const BOG_SUCCESS_URL = process.env.BOG_SUCCESS_URL;
const BOG_FAIL_URL = process.env.BOG_FAIL_URL;

// WooPay Crypto (redirect) configuration (placeholders)
const WOOPAY_GATEWAY_URL = process.env.WOOPAY_GATEWAY_URL || '';
const WOOPAY_MERCHANT_ID = process.env.WOOPAY_MERCHANT_ID || '';
const WOOPAY_SECRET_KEY = process.env.WOOPAY_SECRET_KEY || '';
const WOOPAY_API_KEY = process.env.WOOPAY_API_KEY || '';
const WOOPAY_CALLBACK_URL = process.env.WOOPAY_CALLBACK_URL;
const WOOPAY_SUCCESS_URL = process.env.WOOPAY_SUCCESS_URL;
const WOOPAY_FAIL_URL = process.env.WOOPAY_FAIL_URL;
const WOOPAY_NETWORK = process.env.WOOPAY_NETWORK || '';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files from public directory and subfolders for backwards compatibility
app.use(express.static(PUBLIC_DIR));
app.use(express.static(path.join(PUBLIC_DIR, 'css')));
app.use(express.static(path.join(PUBLIC_DIR, 'js')));
app.use(express.static(path.join(PUBLIC_DIR, 'images')));

// Basic health check (includes DB and currency)
app.get('/api/health', (_req, res) => {
    db.get('SELECT 1 as ok', (err) => {
        res.json({
            ok: !err,
            server: 'server',
            currency: CURRENCY,
            db: err ? 'error' : 'connected',
        });
    });
});

// Payment provider info
app.get('/api/payments/provider', (_req, res) => {
    const currency = PAYMENT_PROVIDER === 'bog'
        ? BOG_CURRENCY
        : PAYMENT_PROVIDER === 'woopay'
            ? WOOPAY_CURRENCY
            : CURRENCY;

    res.json({
        provider: PAYMENT_PROVIDER,
        currency,
        bogConfigured: isBogConfigured(),
        woopayConfigured: isWoopayConfigured(),
        supportedProviders: ['bog', 'woopay']
    });
});

// Helper to compute total from an array of items [{ price: number }]
function calculateOrderTotal(items = []) {
    return items.reduce((sum, item) => {
        const priceNum = Number(item?.price);
        const safePrice = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : 0;
        return sum + safePrice;
    }, 0);
}

function resolveReturnUrl(req, fallback) {
    // Prefer explicit env vars; otherwise build from request origin.
    if (fallback) return fallback;
    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    return origin;
}

function isBogConfigured() {
    return Boolean(BOG_GATEWAY_URL && BOG_MERCHANT_ID && BOG_TERMINAL_ID && BOG_SECRET_KEY);
}

function isWoopayConfigured() {
    return Boolean(WOOPAY_GATEWAY_URL && WOOPAY_MERCHANT_ID && WOOPAY_SECRET_KEY);
}

function buildBogSignature(payload) {
    // Placeholder signature builder: adjust according to bank docs.
    // Many providers require concatenated fields + HMAC-SHA256.
    const orderedKeys = [
        'merchantId',
        'terminalId',
        'orderId',
        'amount',
        'currency',
        'successUrl',
        'failUrl',
        'callbackUrl'
    ];
    const raw = orderedKeys.map((k) => payload[k] ?? '').join('|');
    return crypto.createHmac('sha256', BOG_SECRET_KEY).update(raw).digest('hex');
}

function buildBogRedirectPayload({ req, items, metadata }) {
    const amount = calculateOrderTotal(items);

    if (!amount || amount <= 0) {
        return { error: 'Invalid order total.' };
    }

    const orderId = `ORD-${Date.now()}`;
    const origin = resolveReturnUrl(req);

    const payload = {
        merchantId: BOG_MERCHANT_ID,
        terminalId: BOG_TERMINAL_ID,
        orderId,
        amount: amount.toFixed(2),
        currency: BOG_CURRENCY,
        description: metadata?.description || 'Order payment',
        customerEmail: metadata?.email || '',
        successUrl: BOG_SUCCESS_URL || `${origin}/payments/bog/success`,
        failUrl: BOG_FAIL_URL || `${origin}/payments/bog/fail`,
        callbackUrl: BOG_CALLBACK_URL || `${origin}/api/payments/bog/callback`
    };

    payload.signature = buildBogSignature(payload);
    return { payload, gatewayUrl: BOG_GATEWAY_URL };
}

function buildWoopaySignature(payload) {
    // Placeholder HMAC builder; align with WooPay's expected field ordering.
    const orderedKeys = [
        'merchantId',
        'orderId',
        'amount',
        'currency',
        'callbackUrl'
    ];
    const raw = orderedKeys.map((k) => payload[k] ?? '').join('|');
    return crypto.createHmac('sha256', WOOPAY_SECRET_KEY).update(raw).digest('hex');
}

function buildWoopayRedirectPayload({ req, items, metadata }) {
    const amount = calculateOrderTotal(items);

    if (!amount || amount <= 0) {
        return { error: 'Invalid order total.' };
    }

    const orderId = `WP-${Date.now()}`;
    const origin = resolveReturnUrl(req);

    const payload = {
        merchantId: WOOPAY_MERCHANT_ID,
        orderId,
        amount: amount.toFixed(2),
        currency: WOOPAY_CURRENCY,
        description: metadata?.description || 'Order payment',
        customerEmail: metadata?.email || '',
        network: metadata?.network || WOOPAY_NETWORK,
        successUrl: WOOPAY_SUCCESS_URL || `${origin}/payments/woopay/success`,
        failUrl: WOOPAY_FAIL_URL || `${origin}/payments/woopay/fail`,
        callbackUrl: WOOPAY_CALLBACK_URL || `${origin}/api/payments/woopay/callback`
    };

    if (WOOPAY_API_KEY) {
        payload.apiKey = WOOPAY_API_KEY;
    }

    payload.signature = buildWoopaySignature(payload);
    return { payload, gatewayUrl: WOOPAY_GATEWAY_URL };
}

// --- Bank of Georgia Hosted Checkout (redirect) ---
app.post('/api/payments/bog/create-order', (req, res) => {
    try {
        if (PAYMENT_PROVIDER !== 'bog') {
            return res.status(400).json({ error: 'PAYMENT_PROVIDER is not set to bog.' });
        }

        if (!isBogConfigured()) {
            return res.status(500).json({
                error: 'Bank of Georgia is not configured. Set BOG_GATEWAY_URL, BOG_MERCHANT_ID, BOG_TERMINAL_ID, BOG_SECRET_KEY.'
            });
        }

        const { items = [], metadata = {} } = req.body || {};
        const { payload, gatewayUrl, error } = buildBogRedirectPayload({ req, items, metadata });

        if (error) {
            return res.status(400).json({ error });
        }

        if (!gatewayUrl) {
            return res.status(500).json({ error: 'Gateway URL is missing.' });
        }

        res.json({
            gatewayUrl,
            method: 'POST',
            payload,
            message: 'Submit payload to gatewayUrl to continue checkout.'
        });
    } catch (err) {
        console.error('BOG create-order error:', err);
        res.status(500).json({ error: 'Failed to prepare Bank of Georgia checkout.' });
    }
});

// Callback / webhook receiver (placeholder; adjust per bank docs)
app.post('/api/payments/bog/callback', (req, res) => {
    if (PAYMENT_PROVIDER !== 'bog') {
        return res.status(404).end();
    }

    if (!isBogConfigured()) {
        return res.status(500).json({ error: 'Bank of Georgia is not configured.' });
    }

    const incoming = req.body || {};
    const providedSig = incoming.signature || incoming.SIGNATURE || incoming.sign || incoming.SIGN;

    let validSignature = true;
    if (providedSig) {
        const expectedSig = buildBogSignature({
            merchantId: incoming.merchantId || incoming.merchant_id || BOG_MERCHANT_ID,
            terminalId: incoming.terminalId || incoming.terminal_id || BOG_TERMINAL_ID,
            orderId: incoming.orderId || incoming.order_id || incoming.ORDER_ID,
            amount: incoming.amount || incoming.AMOUNT,
            currency: (incoming.currency || incoming.CURRENCY || BOG_CURRENCY || '').toString().toUpperCase(),
            successUrl: incoming.successUrl || incoming.SUCCESS_URL || '',
            failUrl: incoming.failUrl || incoming.FAIL_URL || '',
            callbackUrl: incoming.callbackUrl || incoming.CALLBACK_URL || ''
        });

        validSignature = expectedSig === providedSig;
    }

    if (!validSignature) {
        console.warn('BOG callback signature invalid', { incoming });
        return res.status(400).json({ received: true, valid: false });
    }

    console.log('BOG callback received', incoming);
    // TODO: update order status in DB and deliver goods.
    res.json({ received: true, valid: true });
});

// --- WooPay Crypto Hosted Checkout (redirect) ---
app.post('/api/payments/woopay/create-order', (req, res) => {
    try {
        if (PAYMENT_PROVIDER !== 'woopay') {
            return res.status(400).json({ error: 'PAYMENT_PROVIDER is not set to woopay.' });
        }

        if (!isWoopayConfigured()) {
            return res.status(500).json({
                error: 'WooPay is not configured. Set WOOPAY_GATEWAY_URL, WOOPAY_MERCHANT_ID, WOOPAY_SECRET_KEY.'
            });
        }

        const { items = [], metadata = {} } = req.body || {};
        const { payload, gatewayUrl, error } = buildWoopayRedirectPayload({ req, items, metadata });

        if (error) {
            return res.status(400).json({ error });
        }

        if (!gatewayUrl) {
            return res.status(500).json({ error: 'Gateway URL is missing.' });
        }

        res.json({
            gatewayUrl,
            method: 'POST',
            payload,
            provider: 'woopay',
            message: 'Submit payload to gatewayUrl to continue checkout.'
        });
    } catch (err) {
        console.error('WooPay create-order error:', err);
        res.status(500).json({ error: 'Failed to prepare WooPay checkout.' });
    }
});

// Callback / webhook receiver (placeholder; adjust per WooPay docs)
app.post('/api/payments/woopay/callback', (req, res) => {
    if (PAYMENT_PROVIDER !== 'woopay') {
        return res.status(404).end();
    }

    if (!isWoopayConfigured()) {
        return res.status(500).json({ error: 'WooPay is not configured.' });
    }

    const incoming = req.body || {};
    const providedSig = incoming.signature || incoming.SIGNATURE || incoming.sig || incoming.SIG;

    let validSignature = true;
    if (providedSig) {
        const expectedSig = buildWoopaySignature({
            merchantId: incoming.merchantId || incoming.merchant_id || WOOPAY_MERCHANT_ID,
            orderId: incoming.orderId || incoming.order_id || incoming.ORDER_ID,
            amount: incoming.amount || incoming.AMOUNT,
            currency: (incoming.currency || incoming.CURRENCY || WOOPAY_CURRENCY || '').toString().toUpperCase(),
            callbackUrl: incoming.callbackUrl || incoming.CALLBACK_URL || ''
        });

        validSignature = expectedSig === providedSig;
    }

    if (!validSignature) {
        console.warn('WooPay callback signature invalid', { incoming });
        return res.status(400).json({ received: true, valid: false });
    }

    console.log('WooPay callback received', incoming);
    // TODO: update order status in DB and deliver goods.
    res.json({ received: true, valid: true });
});

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'main.html'));
});

// Additional routes for other pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'Login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'register.html'));
});

app.get('/send-money', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'send-money.html'));
});

// API Routes

// Registration endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { fullname, email, phone, password, confirmPassword } = req.body;

        // Validation
        if (!fullname || !email || !phone || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        getUserByEmail(email, async (err, existingUser) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email already registered' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            createUser({
                fullname,
                email,
                phone,
                password: hashedPassword
            }, (err, userId) => {
                if (err) {
                    if (err.message.includes('UNIQUE constraint')) {
                        return res.status(400).json({ success: false, message: 'Email already registered' });
                    }
                    return res.status(500).json({ success: false, message: 'Error creating user' });
                }

                // Set session
                req.session.userId = userId;
                req.session.email = email;
                req.session.fullname = fullname;

                res.json({ 
                    success: true, 
                    message: 'Registration successful',
                    user: {
                        id: userId,
                        email: email,
                        fullname: fullname
                    }
                });
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Login endpoint
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        // Get user from database
        getUserByEmail(email, async (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }

            // Check password
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }

            // Set session
            req.session.userId = user.id;
            req.session.email = user.email;
            req.session.fullname = user.fullname;

            res.json({ 
                success: true, 
                message: 'Login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    fullname: user.fullname
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Check session endpoint
app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        getUserById(req.session.userId, (err, user) => {
            if (err || !user) {
                req.session.destroy();
                return res.json({ loggedIn: false });
            }
            res.json({ 
                loggedIn: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullname: user.fullname
                }
            });
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error logging out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});
