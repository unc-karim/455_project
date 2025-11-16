# Elliptic Curve Calculator (Flask)

An educational elliptic curve calculator with tutorials, encryption demos, and history tracking. The app is organized as a Flask package (`app/`) with a thin entry point (`server.py`) and a deployment helper for Google Cloud Run.

## Project Layout
- `app/` — Flask package with route modules and ECC logic.
- `server.py` — entry point exposing `app` for Gunicorn/Cloud Run.
- `deployment/` — Dockerfile and `deploy.sh` helper.
- `requirements.txt` — runtime dependencies.
- `templates/`, `static/` — UI assets.

## Running Locally
### Configure environment
Copy `.env` (provided) and replace values as needed:
```
FLASK_SECRET_KEY=change-me        # generate a real secret for sessions
DB_PATH=./app.db                  # adjust if you want a different location
```

### Install and run
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python server.py  # serves on http://localhost:5000
```

## Docker (local)
```bash
docker build -t ecc-calculator -f deployment/Dockerfile .
docker run -p 8080:8080 --env-file .env ecc-calculator
# App available at http://localhost:8080
```

## Deploy to Google Cloud Run
Prereqs: `gcloud` CLI configured with a project and Cloud Run enabled.
```bash
PROJECT_ID=my-project \
REGION=us-central1 \
SERVICE_NAME=ecc-calculator \
FLASK_SECRET_KEY=$(python - <<'PY'
import secrets; print(secrets.token_hex(16))
PY
) \
DB_PATH=/app/app.db \
./deployment/deploy.sh
```
- `FLASK_SECRET_KEY`: required for session security (set explicitly in production).
- `DB_PATH`: optional; defaults to `/app/app.db`. Cloud Run’s filesystem is ephemeral—use a managed database (e.g., Cloud SQL) for persistent data.

## Notes
- Do not commit real secrets. Supply them via environment variables when running or deploying.
- The app logic remains unchanged from the original routes; only the packaging/structure was refactored for clarity and deployment readiness.
