# Inkwell – Blog with Node.js + Express REST API

## Run it
1. Install Node.js 18 or newer from https://nodejs.org
2. In this folder run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000

Optional: `npm test` runs the API tests (no install needed).

## Folder structure
```
server.js            Express app: routes, JSON parsing, static files, errors
src/db.js            JSON-file database (data/db.json, created automatically)
src/auth.js          scrypt password hashing, signed tokens, requireAuth middleware
src/controllers.js   Handlers for register, login, posts
public/              Frontend (HTML, CSS, js/app.js) served by Express
test.js              API tests
```

## REST API
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | no | User Registration |
| POST | /api/auth/login | no | User Login |
| GET | /api/auth/me | yes | Current user |
| GET | /api/posts?q=&cat= | no | List / search posts |
| GET | /api/posts/mine | yes | Your posts |
| POST | /api/posts | yes | Create Blog |
| PUT | /api/posts/:id | yes | Edit your post |
| DELETE | /api/posts/:id | yes | Delete your post |

Protected routes need the header `Authorization: Bearer <token>` (the token is returned by register and login).

### Try with curl
```
curl -X POST localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Asha Rao","email":"asha@example.com","password":"secret1"}'

curl -X POST localhost:3000/api/posts -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"My first post","cat":"Technology","body":"Ten or more words are needed here so the post passes validation."}'
```
Errors return JSON like `{"error":"Email or password is incorrect."}` with a suitable status code (400, 401, 403, 404, 409, 429).

## Notes
- Passwords are hashed with scrypt; tokens are HMAC-signed and expire in 7 days. Set `TOKEN_SECRET` and `PORT` as environment variables for deployment.
- The JSON-file database suits learning projects. For production, switch to MongoDB or PostgreSQL by replacing `src/db.js`.
