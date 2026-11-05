const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DB = path.join(__dirname, "data.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const load = () => {
  try { return JSON.parse(fs.readFileSync(DB, "utf8")); }
  catch { return [{ id: 1, title: "Welcome to your blog", author: "Admin", content: "This is your first post.\n\nLog in as admin to write, edit and delete posts.", createdAt: new Date().toISOString() }]; }
};
const save = (posts) => fs.writeFileSync(DB, JSON.stringify(posts, null, 2));

const auth = (req, res, next) =>
  req.get("x-admin-password") === ADMIN_PASSWORD ? next() : res.status(401).json({ error: "Unauthorized" });

const clean = (b) => ({
  title: String(b.title || "").trim().slice(0, 150),
  author: String(b.author || "Admin").trim().slice(0, 60),
  content: String(b.content || "").trim().slice(0, 20000),
});

app.get("/api/posts", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  res.json(load().filter(p => !q || (p.title + p.content).toLowerCase().includes(q)).sort((a, b) => b.id - a.id));
});
app.get("/api/posts/:id", (req, res) => {
  const p = load().find(p => p.id === +req.params.id);
  p ? res.json(p) : res.status(404).json({ error: "Not found" });
});
app.post("/api/login", auth, (req, res) => res.json({ ok: true }));
app.post("/api/posts", auth, (req, res) => {
  const d = clean(req.body);
  if (!d.title || !d.content) return res.status(400).json({ error: "Title and content required" });
  const posts = load();
  const post = { id: Math.max(0, ...posts.map(p => p.id)) + 1, ...d, createdAt: new Date().toISOString() };
  posts.push(post); save(posts); res.status(201).json(post);
});
app.put("/api/posts/:id", auth, (req, res) => {
  const posts = load(); const i = posts.findIndex(p => p.id === +req.params.id);
  if (i < 0) return res.status(404).json({ error: "Not found" });
  const d = clean(req.body);
  if (!d.title || !d.content) return res.status(400).json({ error: "Title and content required" });
  posts[i] = { ...posts[i], ...d }; save(posts); res.json(posts[i]);
});
app.delete("/api/posts/:id", auth, (req, res) => {
  const posts = load(); const next = posts.filter(p => p.id !== +req.params.id);
  if (next.length === posts.length) return res.status(404).json({ error: "Not found" });
  save(next); res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Blog running on http://localhost:${PORT}`));
