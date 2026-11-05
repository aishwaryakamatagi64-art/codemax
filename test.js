// Run with:  node test.js   (tests the API handlers without needing a browser)
process.env.DB_FILE = require('path').join(require('os').tmpdir(), 'inkwell-test-' + Date.now() + '.json');
process.env.TOKEN_SECRET = 'test-secret';
const assert = require('assert');
require('./src/db').seed();
const c = require('./src/controllers');
const { requireAuth, verify } = require('./src/auth');
const mkRes = () => { const r = { code: 200 }; r.status = (n) => { r.code = n; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const call = (fn, req) => { const r = mkRes(); fn({ body: {}, query: {}, params: {}, headers: {}, ...req }, r); return r; };
let n = 0; const ok = (name, f) => { f(); n++; console.log('  ok -', name); };

let token, user;
ok('register rejects short password', () => assert.equal(call(c.register, { body: { name: 'Asha Rao', email: 'a@b.com', password: '123' } }).code, 400));
ok('register creates user + token', () => { const r = call(c.register, { body: { name: 'Asha Rao', email: 'A@b.com', password: 'secret1' } }); assert.equal(r.code, 201); token = r.body.token; user = r.body.user; assert.ok(!('password' in r.body.user)); });
ok('duplicate email gives 409', () => assert.equal(call(c.register, { body: { name: 'Asha Rao', email: 'a@b.com', password: 'secret1' } }).code, 409));
ok('login with wrong password gives 401', () => assert.equal(call(c.login, { body: { email: 'a@b.com', password: 'nope123' } }).code, 401));
ok('login works', () => { const r = call(c.login, { body: { email: 'a@b.com', password: 'secret1' } }); assert.equal(r.code, 200); assert.ok(verify(r.body.token)); });
ok('middleware blocks missing token', () => { const r = mkRes(); requireAuth({ headers: {} }, r, () => assert.fail('should not pass')); assert.equal(r.code, 401); });
ok('middleware rejects tampered token', () => { const r = mkRes(); requireAuth({ headers: { authorization: 'Bearer ' + token.slice(0, -2) + 'xx' } }, r, () => assert.fail('no')); assert.equal(r.code, 401); });
const req = () => { const r = { headers: { authorization: 'Bearer ' + token } }; requireAuth(r, mkRes(), () => {}); return r; };
let postId;
ok('create blog validates input', () => assert.equal(call(c.createPost, { ...req(), body: { title: 'Hi', cat: 'Food', body: 'short' } }).code, 400));
ok('create blog succeeds', () => { const r = call(c.createPost, { ...req(), body: { title: 'My first post', cat: 'Technology', body: 'This is a long enough post body with more than ten words in it.' } }); assert.equal(r.code, 201); postId = r.body.post.id; assert.equal(r.body.post.userId, user.id); });
ok('list posts is public and searchable', () => { assert.ok(call(c.listPosts, {}).body.posts.length >= 4); assert.equal(call(c.listPosts, { query: { q: 'first post' } }).body.posts.length, 1); });
ok('my posts returns only mine', () => assert.equal(call(c.myPosts, req()).body.posts.length, 1));
ok('update own post', () => assert.equal(call(c.updatePost, { ...req(), params: { id: postId }, body: { title: 'Edited title', cat: 'Food', body: 'Edited body that is also long enough to pass the word check ok.' } }).body.post.title, 'Edited title'));
ok('cannot delete seed post', () => assert.equal(call(c.deletePost, { ...req(), params: { id: require('./src/db').read().posts[0].id } }).code, 403));
ok('delete own post', () => { assert.equal(call(c.deletePost, { ...req(), params: { id: postId } }).code, 200); assert.equal(call(c.myPosts, req()).body.posts.length, 0); });
console.log(`\n${n} tests passed`);
