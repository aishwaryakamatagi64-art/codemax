# Full Stack Blog

A lightweight, mobile-responsive blog with an Express REST API and a vanilla JS frontend. Includes dark mode, search, and password-protected admin CRUD.

## Features
- Public: browse and read posts, search
- Admin: create, edit and delete posts
- Responsive layout, automatic dark mode
- Input sanitisation (XSS-safe rendering), length limits
- JSON-file persistence (no database setup)

## Tech Stack
Node.js 18+, Express, HTML/CSS/JavaScript

## Run Locally
```bash
npm install
ADMIN_PASSWORD=yourSecret npm start     # Windows PowerShell: $env:ADMIN_PASSWORD="yourSecret"; npm start
```
Open http://localhost:3000. Default password if unset: `admin123` (change it!).

## API
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/posts?q= | – | List/search posts |
| GET | /api/posts/:id | – | Get one post |
| POST | /api/login | header | Verify admin password |
| POST | /api/posts | header | Create post |
| PUT | /api/posts/:id | header | Update post |
| DELETE | /api/posts/:id | header | Delete post |

Auth header: `x-admin-password: <ADMIN_PASSWORD>`

## Deploy on Render (recommended)
1. Push this folder to a GitHub repo.
2. On https://render.com choose **New → Web Service** and connect the repo (or use **Blueprint** with `render.yaml`).
3. Build command: `npm install`, Start command: `npm start`.
4. Add environment variable `ADMIN_PASSWORD`.
5. Deploy and open the generated URL.

Note: Render's free tier has an ephemeral disk, so posts reset on redeploy. For permanent storage, add a Render Disk or swap `data.json` for a database (MongoDB Atlas / Postgres). This JSON-file design also isn't suited to Vercel/Netlify serverless without a database.

## Project Structure
```
server.js        Express API + static hosting
public/index.html  Frontend (SPA)
render.yaml      Render blueprint
```

## License
MIT
