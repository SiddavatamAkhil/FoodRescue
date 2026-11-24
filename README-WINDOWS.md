# Running FoodRescue on Windows

This bundle includes the installed web dependencies (`apps/web/node_modules`, Windows build) and every Python package as Windows wheels (`vendor/python-wheels`), so setup works without downloading packages.

## You need
- **Node.js 20 LTS**: https://nodejs.org/
- **Python 3.11, 3.12 or 3.13 (64-bit)**: https://www.python.org/downloads/ (tick **Add python.exe to PATH**)

Docker, PostgreSQL and Redis are **not** needed for local use. The setup script uses a SQLite database file.

## Steps
1. Extract the zip to a short path, for example `C:\foodrescue`. Very long paths can break `node_modules` on Windows.
2. Double-click **`setup-windows.bat`**. It:
   - creates a Python virtual environment in `apps\api\.venv`
   - installs the Python packages from the bundled wheels
   - writes `apps\api\.env` (SQLite database, new random secret key) and `apps\web\.env.local`
   - creates the database tables and asks for your administrator email and password
3. Double-click **`start-foodrescue.bat`**. Your browser opens http://localhost:3000.

## Using it
- Sign in as the administrator you created to verify organisations.
- Sign up as a donor, NGO, volunteer or company in another browser or a private window.
- There's no email server, so confirmation and password-reset links are printed in the **FoodRescue API** window. Copy them into the browser.
- Optional demo data: sign in as admin, then open http://127.0.0.1:8000/api/v1/docs, authorise, and run `POST /admin/seed-demo`. Demo logins: `demo_donor@foodrescue.org` / `demo_ngo@foodrescue.org`, password `demopassword123`.

## Running the tests
```bat
cd apps\api
.venv\Scripts\python.exe -m pytest
```

## Production
Use Docker and PostgreSQL as described in `README.md` (`docker-compose up --build`, then `alembic upgrade head`). SQLite mode is for local development and demos only.
