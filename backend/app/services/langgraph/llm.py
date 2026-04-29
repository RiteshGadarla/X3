from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import get_settings

# Model mapping (1-5) as requested
MODEL_MAP = {
    1: "models/gemma-4-31b-it",       # highest quality
    2: "models/gemma-4-26b-a4b-it",   # slightly lighter, still very strong
    3: "models/gemma-3-27b-it",       # strong reasoning
    4: "models/gemma-3-12b-it",       # mid-tier balance
    5: "models/gemma-3-1b-it"         # fastest, lowest cost
}

def get_llm(model_id: int = 1):
    """
    Returns an LLM instance based on the model ID mapping.
    This centralized factory makes it easy to switch providers (e.g., to Groq) later.
    """
    # Ensure model_id is an integer, default to 1 if not found
    try:
        mid = int(model_id)
    except (ValueError, TypeError):
        mid = 1
        
    model_name = MODEL_MAP.get(mid, MODEL_MAP[1])
    
    # Currently using Google Generative AI
    # To switch to Groq, you would replace the return below with:
    # from langchain_groq import ChatGroq
    # return ChatGroq(model=model_name, temperature=0)
    
    settings = get_settings()
    api_key = settings.gemini_api_key
    return ChatGoogleGenerativeAI(model=model_name, temperature=0, google_api_key=api_key)
