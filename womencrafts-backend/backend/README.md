# WomSakhi Backend

FastAPI backend for the WomSakhi project.

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # macOS/Linux
# venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## Run Development Server

```bash
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs
