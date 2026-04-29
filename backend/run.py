import uvicorn

if __name__ == "__main__":
    # Runs the FastAPI application with hot-reloading enabled for development.
    # Exclude logs and db from reload to prevent infinite loops.
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        reload_excludes=["*.log", "logs/*", "*.db"]
    )
