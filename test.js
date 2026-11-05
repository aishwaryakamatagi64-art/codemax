// Run with:  node test.js   (tests the API handlers using the JSON-file store; no database or browser needed)
process.env.DB_FILE = require('path').join(require('os').tmpdir(), 'inkwell-test-' + Date.now() + '.json');
process.env.TOKEN_SECRET = 'test-secret';
delete process.env.MONGODB_URI;
const assert = require('assert');
const store = require('./src/store');
const c = require('./src/controllers');
const { requireAuth, requirePage, guestOnly, verify, sign } = require('./src/auth');
const crypto = require('crypto');
const mkRes = () => { const r = { code: 200, cookies: {} }; r.status = (n) => { r.code = n; return r; }; r.json = (b) => { r.body = b; return r; }; r.cookie = (k, v, o) => { r.cookies[k] = { v, o }; }; r.clearCookie = (k) => { r.cookies[k] = null; }; r.redirect = (u) => { r.redirectedTo = u; }; return r; };
const call = async (fn, req) => { const r = mkRes(); await fn({ body: {}, query: {}, params: {}, headers: {}, ...req }, r); return r; };
let n = 0; const ok = async (name, f) => { await f(); n++; console.log('  ok -', name); };

(async () => {
  await store.init();
  let token, user, postId;
  const auth = () => { const r = { headers: { authorization: 'Bearer ' + token } }; requireAuth(r, mkRes(), () => {}); return r; };

  await ok('register rejects short password', async () => assert.equal((await call(c.register, { body: { name: 'Asha Rao', email: 'a@b.com', password: '123' } })).code, 400));
  await ok('register creates user + token, hides password', async () => { const r = await call(c.register, { body: { name: 'Asha Rao', email: 'A@b.com', password: 'secret1' } }); assert.equal(r.code, 201); token = r.body.token; user = r.body.user; assert.ok(!('password' in user)); });
  await ok('stored password is hashed, not plain text', async () => { const u = await store.findUserByEmail('a@b.com'); assert.ok(u.password.includes(':') && !u.password.includes('secret1')); });
  await ok('duplicate email gives 409', async () => assert.equal((await call(c.register, { body: { name: 'Asha Rao', email: 'a@b.com', password: 'secret1' } })).code, 409));
  await ok('wrong password gives 401', async () => assert.equal((await call(c.login, { body: { email: 'a@b.com', password: 'nope123' } })).code, 401));
  await ok('login works', async () => { const r = await call(c.login, { body: { email: 'a@b.com', password: 'secret1' } }); assert.equal(r.code, 200); assert.ok(verify(r.body.token)); });
  await ok('middleware blocks missing/tampered token', async () => {
    let r = mkRes(); requireAuth({ headers: {} }, r, () => assert.fail('no')); assert.equal(r.code, 401);
    r = mkRes(); requireAuth({ headers: { authorization: 'Bearer ' + token.slice(0, -2) + 'xx' } }, r, () => assert.fail('no')); assert.equal(r.code, 401); });
  await ok('create blog validates input', async () => assert.equal((await call(c.createPost, { ...auth(), body: { title: 'Hi', cat: 'Food', body: 'short' } })).code, 400));
  await ok('create blog saves to database', async () => { const r = await call(c.createPost, { ...auth(), body: { title: 'My first post', cat: 'Technology', body: 'This is a long enough post body with more than ten words in it.' } }); assert.equal(r.code, 201); postId = r.body.post.id; assert.equal(r.body.post.userId, user.id); });
  await ok('all blogs are retrieved (seed + new)', async () => assert.equal((await call(c.listPosts, {})).body.posts.length, 4));
  await ok('newest post comes first', async () => assert.equal((await call(c.listPosts, {})).body.posts[0].id, postId));
  await ok('search and category filter work', async () => { assert.equal((await call(c.listPosts, { query: { q: 'FIRST POST' } })).body.posts.length, 1); assert.equal((await call(c.listPosts, { query: { cat: 'Travel' } })).body.posts.length, 1); });
  await ok('categories endpoint returns counts', async () => { const r = (await call(c.categories, {})).body; assert.equal(r.total, 4); assert.equal(r.categories.find((x) => x.name === 'Technology').count, 2); });
  await ok('single blog details by id', async () => { const r = await call(c.getPost, { params: { id: postId } }); assert.equal(r.code, 200); assert.equal(r.body.post.title, 'My first post'); });
  await ok('combined search + category filter', async () => assert.equal((await call(c.listPosts, { query: { q: 'first', cat: 'Food' } })).body.posts.length, 0));
  await ok('unknown blog id gives 404', async () => assert.equal((await call(c.getPost, { params: { id: 'nope' } })).code, 404));
  await ok('my posts returns only mine', async () => assert.equal((await call(c.myPosts, auth())).body.posts.length, 1));
  await ok('update own post', async () => assert.equal((await call(c.updatePost, { ...auth(), params: { id: postId }, body: { title: 'Edited title', cat: 'Food', body: 'Edited body that is also long enough to pass the word check ok.' } })).body.post.title, 'Edited title'));
  await ok('cannot delete someone else\'s post', async () => { const seed = (await store.listPosts({}))[3]; assert.equal((await call(c.deletePost, { ...auth(), params: { id: seed.id } })).code, 403); });
  await ok('delete own post', async () => { assert.equal((await call(c.deletePost, { ...auth(), params: { id: postId } })).code, 200); assert.equal((await call(c.getPost, { params: { id: postId } })).code, 404); });

  // ----- JWT & session -----
  await ok('token is a real 3-part JWT (HS256) with sub/exp claims', async () => { const [h, p] = token.split('.'); assert.equal(token.split('.').length, 3); assert.equal(JSON.parse(Buffer.from(h, 'base64url')).alg, 'HS256'); const c2 = JSON.parse(Buffer.from(p, 'base64url')); assert.equal(c2.sub, user.id); assert.ok(c2.exp > c2.iat); });
  await ok('login sets an httpOnly, SameSite=Strict cookie', async () => { const r = await call(c.login, { body: { email: 'a@b.com', password: 'secret1' } }); const k = r.cookies.ink_token; assert.ok(k.v); assert.equal(k.o.httpOnly, true); assert.equal(k.o.sameSite, 'strict'); });
  await ok('expired token is rejected', async () => { const old = sign({ sub: user.id, name: 'x' }, -1); assert.equal(verify(old), null); });
  await ok('token with alg "none" is rejected', async () => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); assert.equal(verify(b({ alg: 'none', typ: 'JWT' }) + '.' + b({ sub: user.id, exp: 9999999999 }) + '.x'), null); });
  await ok('API accepts the cookie as well as Bearer header', async () => { const r = mkRes(); let passed = false; requireAuth({ headers: { cookie: 'a=1; ink_token=' + token } }, r, () => { passed = true; }); assert.ok(passed); });
  await ok('protected pages redirect visitors without a login', async () => { const r = mkRes(); requirePage({ headers: {} }, r, () => assert.fail('no')); assert.equal(r.redirectedTo, '/login.html'); const r2 = mkRes(); let ok2 = false; requirePage({ headers: { cookie: 'ink_token=' + token } }, r2, () => { ok2 = true; }); assert.ok(ok2); });
  await ok('logged-in users are redirected away from login page', async () => { const r = mkRes(); guestOnly({ headers: { cookie: 'ink_token=' + token } }, r, () => assert.fail('no')); assert.equal(r.redirectedTo, '/dashboard.html'); });
  await ok('logout clears the cookie', async () => { const r = await call(c.logout, {}); assert.equal(r.cookies.ink_token, null); });

  // ----- dashboard shows only my blogs -----
  let t2, u2;
  await ok('second user sees none of the first user\'s blogs', async () => {
    const r = await call(c.register, { body: { name: 'Ravi Kumar', email: 'ravi@b.com', password: 'secret2' } }); t2 = r.body.token; u2 = r.body.user;
    const mine = (id, tk) => { const q = { headers: { authorization: 'Bearer ' + tk } }; requireAuth(q, mkRes(), () => {}); return q; };
    await call(c.createPost, { ...mine(u2.id, t2), body: { title: 'Ravi writes', cat: 'Travel', body: 'A post by Ravi that has more than ten words so it is valid.' } });
    await call(c.createPost, { ...auth(), body: { title: 'Asha writes', cat: 'Food', body: 'A post by Asha that has more than ten words so it is valid.' } });
    const a = (await call(c.myPosts, auth())).body.posts, b = (await call(c.myPosts, mine(u2.id, t2))).body.posts;
    assert.deepEqual(a.map((p) => p.title), ['Asha writes']); assert.deepEqual(b.map((p) => p.title), ['Ravi writes']); });
  await ok('Ravi cannot edit or delete Asha\'s post', async () => { const ap = (await call(c.myPosts, auth())).body.posts[0]; const q = { headers: { authorization: 'Bearer ' + t2 } }; requireAuth(q, mkRes(), () => {});
    assert.equal((await call(c.deletePost, { ...q, params: { id: ap.id } })).code, 403); assert.equal((await call(c.updatePost, { ...q, params: { id: ap.id }, body: { title: 'hack', cat: 'Food', body: 'x '.repeat(12) } })).code, 403); });

  // ----- profile -----
  await ok('profile returns user without password', async () => { const r = await call(c.me, auth()); assert.equal(r.body.user.email, 'a@b.com'); assert.ok(!('password' in r.body.user)); assert.ok(r.body.user.createdAt); });
  await ok('rename updates profile, author on blogs and refreshes cookie', async () => { const r = await call(c.updateProfile, { ...auth(), body: { name: 'Asha R' } }); assert.equal(r.body.user.name, 'Asha R'); assert.ok(r.cookies.ink_token.v); assert.equal((await call(c.myPosts, auth())).body.posts[0].author, 'Asha R'); });
  await ok('name validation', async () => assert.equal((await call(c.updateProfile, { ...auth(), body: { name: 'A' } })).code, 400));
  await ok('change password needs the correct current password', async () => assert.equal((await call(c.changePassword, { ...auth(), body: { currentPassword: 'wrong1', newPassword: 'newsecret' } })).code, 403));
  await ok('change password works; old password stops working', async () => { assert.equal((await call(c.changePassword, { ...auth(), body: { currentPassword: 'secret1', newPassword: 'newsecret' } })).code, 200); assert.equal((await call(c.login, { body: { email: 'a@b.com', password: 'secret1' } })).code, 401); assert.equal((await call(c.login, { body: { email: 'a@b.com', password: 'newsecret' } })).code, 200); });
  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
