const path = require('path');
const express = require('express');
const db = require('./src/db');
const { requireAuth } = require('./src/auth');
const c = require('./src/controllers');

db.seed();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Very small rate limiter for login/register (per IP, 20 requests / 15 min)
const hits = new Map();
function limiter(req, res, next) {
  const k = req.ip, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (arr.length >= 20) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  arr.push(now); hits.set(k, arr); next();
}

// ----- REST API -----
const api = express.Router();
api.post('/auth/register', limiter, c.register);   // User Registration
api.post('/auth/login', limiter, c.login);         // User Login
api.get('/auth/me', requireAuth, c.me);
api.get('/posts', c.listPosts);                    // public list (search: ?q=&cat=)
api.get('/posts/mine', requireAuth, c.myPosts);
api.post('/posts', requireAuth, c.createPost);     // Create Blog
api.put('/posts/:id', requireAuth, c.updatePost);
api.delete('/posts/:id', requireAuth, c.deletePost);
api.use((req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use('/api', api);

// ----- Frontend -----
app.use(express.static(path.join(__dirname, 'public')));

// Errors (e.g. invalid JSON) -> JSON response
app.use((err, req, res, next) => {
  const code = err.status || 500;
  res.status(code).json({ error: code === 500 ? 'Something went wrong on the server.' : 'Invalid request.' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`Inkwell running at http://localhost:${PORT}`));
module.exports = app;
