# WomenCrafts Backend

WomenCrafts empowers women artisans and entrepreneurs by providing a platform to showcase, promote, and sell handmade products and creative work. We connect traditional craftsmanship with modern opportunities, helping women grow their businesses, reach wider audiences, and achieve financial independence.

---

## Tech Stack

- [FastAPI](https://fastapi.tiangolo.com/) — Python web framework
- [Uvicorn](https://www.uvicorn.org/) — ASGI server
- [Pydantic v2](https://docs.pydantic.dev/) — Data validation
- Python 3.11+

---

## Prerequisites

- Python >= 3.11

Verify with:

```bash
python3 --version
```

---

## Setup

```bash
# 1. Navigate to the backend project folder
cd womencrafts-backend/backend

# 2. Create a virtual environment
python3 -m venv venv

# 3. Activate the virtual environment
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# 4. Install dependencies
pip install -r requirements.txt
```

---

## Run Development Server

```bash
uvicorn main:app --reload --port 8000
```

| URL | Description |
|-----|-------------|
| http://localhost:8000 | API root |
| http://localhost:8000/docs | Swagger UI (interactive docs) |
| http://localhost:8000/redoc | ReDoc documentation |

---

## Stop the Server

Press `Ctrl + C` in the terminal where the server is running.

To deactivate the virtual environment:

```bash
deactivate
```

---

## Adding New Dependencies

```bash
# Install the package
pip install <package-name>

# Update requirements.txt
pip freeze > requirements.txt
```

---

## Project Structure

```
backend/
├── main.py            # FastAPI app entry point
├── requirements.txt   # Python dependencies
├── venv/              # Virtual environment (not committed)
└── README.md
```
