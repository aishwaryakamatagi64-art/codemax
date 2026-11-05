# Inkwell – Blog with Node.js, Express and MongoDB

## 1. Get a MongoDB database (free)
1. Create an account at https://www.mongodb.com/atlas and create a free cluster.
2. Database Access: add a database user (username + password).
3. Network Access: add your current IP address.
4. Connect > Drivers: copy the connection string.
(Or install MongoDB locally and use `mongodb://127.0.0.1:27017/inkwell`.)

## 2. Run the app
```
npm install
copy .env.example .env      (Mac/Linux: cp .env.example .env)
```
Open `.env`, paste your connection string into `MONGODB_URI`, set a long random `TOKEN_SECRET`, then:
```
npm start
```
Open http://localhost:3000. The console prints "Database: MongoDB" when connected.
If `MONGODB_URI` is empty, the app falls back to a JSON file (`data/db.json`) so you can still try it.
The first start adds 3 sample posts to an empty database.

`npm test` runs 20 API tests (no database needed).

## Folder structure
```
server.js              Express app and routes
src/store/mongo.js     Mongoose models (User, Post) and MongoDB queries
src/store/file.js      JSON-file fallback with the same methods
src/store/index.js     Chooses MongoDB or file store
src/auth.js            scrypt password hashing, signed tokens, requireAuth
src/controllers.js     Register, login and blog handlers
public/                Frontend: index (all blogs), post (blog details), login,
                       register, dashboard, create-blog
```

## How credentials and posts are stored securely
- Passwords are never stored in plain text: each is hashed with scrypt and a random salt.
- The API never returns password hashes.
- The database password and token secret live in `.env`, which is listed in `.gitignore`.
- Protected routes check a signed token that expires in 7 days; users can edit or delete only their own posts.
- Input is validated on the server, search text is escaped before use in MongoDB queries, and the frontend escapes all text before showing it.

## REST API
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | no | Register |
| POST | /api/auth/login | no | Log in |
| GET | /api/auth/me | yes | Current user |
| GET | /api/posts?q=&cat= | no | All blogs from the database |
| GET | /api/posts/:id | no | One blog's details |
| GET | /api/categories | no | Categories with post counts |
| GET | /api/posts/mine | yes | Your blogs |
| POST | /api/posts | yes | Create blog |
| PUT | /api/posts/:id | yes | Edit your blog |
| DELETE | /api/posts/:id | yes | Delete your blog |

## CRUD features
| Operation | Where in the app | API |
|---|---|---|
| Create | Write page (create-blog.html) | POST /api/posts |
| Read | Home (all blogs), post.html (one blog), Dashboard (your blogs) | GET /api/posts, /api/posts/:id, /api/posts/mine |
| Update | Edit button on Dashboard and on your own blog page | PUT /api/posts/:id |
| Delete | Delete button on Dashboard and on your own blog page (asks to confirm) | DELETE /api/posts/:id |

Search and category filters: the home page has a search box and category buttons with post counts (GET /api/categories). Filters can be combined and are kept in the page address, e.g. `index.html?cat=Food&q=dosa`. The dashboard has its own search box.

## Pages
index.html (all blogs) · post.html?id=... (blog details) · login.html · register.html · dashboard.html · create-blog.html
