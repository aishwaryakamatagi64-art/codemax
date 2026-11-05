// Run with:  node test.js   (tests the API handlers using the JSON-file store; no database or browser needed)
process.env.DB_FILE = require('path').join(require('os').tmpdir(), 'inkwell-test-' + Date.now() + '.json');
process.env.TOKEN_SECRET = 'test-secret';
delete process.env.MONGODB_URI;
const assert = require('assert');
const store = require('./src/store');
const c = require('./src/controllers');
const { requireAuth, verify } = require('./src/auth');
const mkRes = () => { const r = { code: 200 }; r.status = (n) => { r.code = n; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
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
  await ok('single blog details by id', async () => { const r = await call(c.getPost, { params: { id: postId } }); assert.equal(r.code, 200); assert.equal(r.body.post.title, 'My first post'); });
  await ok('unknown blog id gives 404', async () => assert.equal((await call(c.getPost, { params: { id: 'nope' } })).code, 404));
  await ok('my posts returns only mine', async () => assert.equal((await call(c.myPosts, auth())).body.posts.length, 1));
  await ok('update own post', async () => assert.equal((await call(c.updatePost, { ...auth(), params: { id: postId }, body: { title: 'Edited title', cat: 'Food', body: 'Edited body that is also long enough to pass the word check ok.' } })).body.post.title, 'Edited title'));
  await ok('cannot delete someone else\'s post', async () => { const seed = (await store.listPosts({}))[3]; assert.equal((await call(c.deletePost, { ...auth(), params: { id: seed.id } })).code, 403); });
  await ok('delete own post', async () => { assert.equal((await call(c.deletePost, { ...auth(), params: { id: postId } })).code, 200); assert.equal((await call(c.getPost, { params: { id: postId } })).code, 404); });
  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
