### Windows Setup

**1. Setup Environment**
Run this once to install frontend dependencies and setup the Python backend virtual environment:
```powershell
# Setup Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Setup Frontend
cd ..\frontend
npm install
```

**2. Running the Application**

To run the Backend Server (FastAPI + LangGraph):
```powershell
cd backend
# Activate virtual environment
.\venv\Scripts\activate
# Start the server with hot-reloading
python run.py
```
*(On Linux/macOS, use `source venv/bin/activate` instead of `.\venv\Scripts\activate`)*

To run the Frontend Server (Vite):
```powershell
cd frontend
npm run dev
```
