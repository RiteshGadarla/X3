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
