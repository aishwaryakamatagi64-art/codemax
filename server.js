try { require('dotenv').config(); } catch { /* dotenv optional; real environment variables still work */ }
const path = require('path');
const express = require('express');
const store = require('./src/store');
const { requireAuth } = require('./src/auth');
const c = require('./src/controllers');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); next(); });

// Small per-IP limiter for login/register (20 requests / 15 minutes)
const hits = new Map();
function limiter(req, res, next) {
  const now = Date.now(), arr = (hits.get(req.ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (arr.length >= 20) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  arr.push(now); hits.set(req.ip, arr); next();
}
// Express 4 needs this to pass errors from async handlers to the error middleware
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const api = express.Router();
api.post('/auth/register', limiter, h(c.register));
api.post('/auth/login', limiter, h(c.login));
api.get('/auth/me', requireAuth, h(c.me));
api.get('/posts', h(c.listPosts));               // all blogs from the database
api.get('/categories', h(c.categories));         // category list with post counts
api.get('/posts/mine', requireAuth, h(c.myPosts));
api.get('/posts/:id', h(c.getPost));             // single blog details
api.post('/posts', requireAuth, h(c.createPost));
api.put('/posts/:id', requireAuth, h(c.updatePost));
api.delete('/posts/:id', requireAuth, h(c.deletePost));
api.use((req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use('/api', api);

app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  const code = err.status || 500;
  res.status(code).json({ error: code === 500 ? 'Something went wrong on the server.' : 'Invalid request.' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  store.init()
    .then((mode) => app.listen(PORT, () => console.log(`Inkwell running at http://localhost:${PORT}\nDatabase: ${mode}`)))
    .catch((e) => { console.error('Could not connect to the database:', e.message); process.exit(1); });
}
module.exports = app;
