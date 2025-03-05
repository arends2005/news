require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const logger = require('./logger');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const { startBot } = require('./discord/bot');
const adminRoutes = require('./routes/admin');
const User = require('./models/user');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Run migrations in order
async function runMigrations() {
    try {
        const migrationsDir = path.join(__dirname, 'db', 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        // Create migrations table if it doesn't exist
        const createMigrationsTable = fs.readFileSync(path.join(migrationsDir, '000_create_migrations_table.sql'), 'utf8');
        await pool.query(createMigrationsTable);

        // Get list of executed migrations
        const result = await pool.query('SELECT name FROM migrations');
        const executedMigrations = new Set(result.rows.map(row => row.name));

        for (const file of files) {
            // Skip the migrations table creation file
            if (file === '000_create_migrations_table.sql') continue;

            // Skip if migration has already been executed
            if (executedMigrations.has(file)) {
                console.log(`Migration already executed: ${file}`);
                continue;
            }

            console.log(`Running migration: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            
            try {
                await pool.query(sql);
                // Record the migration as executed
                await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            } catch (error) {
                // If the error is about existing column/table, we can ignore it
                if (error.code === '42701' || error.code === '42P07') {
                    console.log(`Migration ${file} already applied (${error.message})`);
                    // Still record it as executed since the schema is already in place
                    await pool.query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
                } else {
                    throw error; // Re-throw other errors
                }
            }
        }
        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Error running migrations:', error);
        throw error;
    }
}

// Create admin user first, before any other initialization
async function createAdminUser() {
    try {
        // Check if admin user exists
        const adminUser = await User.findByEmail(process.env.ADMIN_EMAIL);
        if (adminUser) {
            console.log('Admin user already exists');
            return adminUser;
        }

        // Create admin user if environment variables are set
        if (process.env.ADMIN_USERNAME && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            const adminUser = await User.create({
                username: process.env.ADMIN_USERNAME,
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD,
                isAdmin: true
            });
            console.log('Created admin user:', adminUser.username);
            return adminUser;
        } else {
            console.log('Admin environment variables not set, skipping admin creation');
            return null;
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
        throw error;
    }
}

// Initialize the application
async function initializeApp() {
    try {
        // Wait for database to be ready
        await pool.query('SELECT 1');
        console.log('Database connection established');

        // Run migrations
        await runMigrations();
        console.log('Database migrations completed');

        // Create admin user first
        const adminUser = await createAdminUser();
        
        if (!adminUser) {
            throw new Error('Failed to create admin user. Please check environment variables.');
        }

        // Set up bot user ID to use admin user
        await pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
            ['bot_user_id', adminUser.id.toString()]
        );

        // Start the Discord bot
        logger.info('Attempting to start Discord bot...');
        await startBot();
        logger.info('Discord bot started successfully');

        // Start the Express server
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (err) {
        logger.error('Failed to initialize application:', err);
        process.exit(1);
    }
}

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

// Layout settings
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);
app.set("layout", "layout"); // Set default layout

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return done(null, false, { message: 'Incorrect email or password.' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return done(null, false, { message: 'Incorrect email or password.' });
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Flash messages
app.use(flash());

// Make user data available to all views
app.use((req, res, next) => {
  console.log('User data:', req.user);
  
  if (req.user) {
    res.locals.user = {
      id: req.user.id,
      username: req.user.username,
      dark_mode: req.user.dark_mode,
      is_admin: req.user.is_admin
    };
    console.log('User object for views:', res.locals.user);
  } else {
    res.locals.user = null;
    console.log('No user in session');
  }
  
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success')
  };
  next();
});

// Disable layout for auth pages
app.use('/auth', (req, res, next) => {
  app.set("layout", false);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
routes(app, pool);

// Initialize the application
initializeApp();

// For graceful shutdown
process.on('SIGINT', () => {
  logger.info('Closing database connection...');
  pool.end();
  process.exit(0);
});