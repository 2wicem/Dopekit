# Deploy DopeKit on Railway

Deploy as **three Railway resources** from one GitHub repo:

1. **PostgreSQL** database  
2. **dopekit-api** — Django backend (`Backend/`)  
3. **dopekit-web** — React frontend (`Frontend/`)

---

## 1. Push code to GitHub

```bash
git add .
git commit -m "Prepare Railway deployment"
git push origin main
```

Repo: https://github.com/2wicem/Nails-service

---

## 2. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub  
2. **New Project** → **Deploy from GitHub repo** → select `Nails-service`  
3. Railway creates a first service — we'll reconfigure it below  

---

## 3. Add PostgreSQL

1. In the project, click **+ New** → **Database** → **PostgreSQL**  
2. Wait until it is running  
3. Open the Postgres service → **Connect** → copy **`DATABASE_URL`** (or reference it from other services)  

---

## 4. Backend service (Django API)

### Create / configure service

1. **+ New** → **GitHub Repo** → same repo (or reuse the auto-created service)  
2. **Settings** → **Root Directory** → `Backend`  
3. **Settings** → **Networking** → **Generate Domain** (e.g. `dopekit-api-production.up.railway.app`)  

Railway picks up `Backend/railway.toml` automatically.

### Variables (Backend → Variables)

| Variable | Value |
|----------|--------|
| `DEBUG` | `False` |
| `USE_HTTPS` | `True` |
| `SECRET_KEY` | Generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(use Railway reference to your Postgres service)* |
| `SITE_URL` | `https://YOUR-BACKEND-DOMAIN.up.railway.app` |
| `FRONTEND_URL` | `https://YOUR-FRONTEND-DOMAIN.up.railway.app` *(set after step 5)* |
| `WEB_CONCURRENCY` | `2` |
| `EMAIL_HOST_USER` | *(optional)* your SMTP user |
| `EMAIL_HOST_PASSWORD` | *(optional)* Gmail app password |
| `AT_API_KEY` | *(optional)* Africa's Talking SMS key |
| `BOOKING_NOTIFY_EMAIL` | *(optional)* |
| `BOOKING_NOTIFY_PHONE` | *(optional)* |

**Important:** `SITE_URL` and `FRONTEND_URL` must be full `https://` URLs. They configure CORS, CSRF, cookies, and password-reset links.

### Deploy

Railway builds with Nixpacks, runs migrations, and starts Gunicorn.  
Health check: `GET /products/` → should return JSON.

### Create admin user (one time)

There are **no demo users or pre-seeded salons** — production starts empty after migrations (migration `0017` clears bootstrap placeholders).

Backend → **Settings** → run a one-off command or use Railway shell:

```bash
python manage.py createsuperuser
```

Then add real salons and staff via `/admin` or owner signup. Do not run old demo seed commands (removed from the project).

---

## 5. Frontend service (React SPA)

1. **+ New** → **GitHub Repo** → same repo  
2. **Settings** → **Root Directory** → `Frontend`  
3. **Settings** → **Networking** → **Generate Domain** (e.g. `dopekit-web-production.up.railway.app`)  

### Variables (Frontend → Variables)

| Variable | Value |
|----------|--------|
| `VITE_API_BASE` | `https://YOUR-BACKEND-DOMAIN.up.railway.app` |

**No trailing slash.** This is baked in at **build time** — redeploy frontend after changing it.

### Update backend `FRONTEND_URL`

Go back to the **Backend** service variables and set:

```
FRONTEND_URL=https://YOUR-FRONTEND-DOMAIN.up.railway.app
```

Redeploy the backend so CORS/CSRF allow the frontend origin.

### Deploy

Build: `npm ci && npm run build`  
Start: serves `dist/` as a single-page app.

Open the frontend URL in your browser.

---

## 6. Smoke test

- [ ] Frontend loads (landing page)  
- [ ] Salons / technicians load (no “Could not load…”)  
- [ ] Sign up / log in works  
- [ ] Booking creates a pending appointment  
- [ ] Admin: `https://YOUR-BACKEND-DOMAIN.up.railway.app/admin/`  

---

## Architecture on Railway

```
Browser
   │
   ▼
Frontend (Railway static)  ──HTTPS──►  Backend (Gunicorn/Django)
   VITE_API_BASE = backend URL              │
                                            ▼
                                      PostgreSQL (Railway)
```

Session cookies + CSRF work across split domains when `SITE_URL`, `FRONTEND_URL`, and `USE_HTTPS=True` are set correctly.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Frontend shows HTML instead of JSON | Wrong `VITE_API_BASE` — must be backend URL, then **redeploy frontend** |
| Login loop (always sent back to login) | Split domains need cross-site cookies: set `FRONTEND_URL` + `SITE_URL` with `https://`, `USE_HTTPS=True`, **delete** `SESSION_COOKIE_SAMESITE` / `CSRF_COOKIE_SAMESITE` if set to `Lax`, redeploy backend |
| Login doesn’t stick | Set `FRONTEND_URL` on backend; both URLs must use `https://` |
| 502 on backend | Check deploy logs; confirm `DATABASE_URL` and migrations ran |
| CORS / 403 on POST | Redeploy backend after updating `FRONTEND_URL` |
| Empty salons list | Run `createsuperuser`, add salons in Django admin |

---

## Optional: custom domains

1. Add custom domain on each Railway service (Networking)  
2. Update `SITE_URL`, `FRONTEND_URL`, and `VITE_API_BASE` to match  
3. Redeploy backend and frontend  

---

## Cost note

Railway offers a trial / hobby plan with usage limits. Postgres + two web services may incur cost after free credits — check [railway.app/pricing](https://railway.app/pricing).
