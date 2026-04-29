import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.services.langgraph.llm import MODEL_MAP

def test_gemini_models():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY or GOOGLE_API_KEY not found in environment variables.")
        return

    genai.configure(api_key=api_key)

    test_prompt = "Hello! Briefly state your model name and one interesting fact about yourself."

    print(f"Starting test for {len(MODEL_MAP)} models...")
    print(f"Prompt: {test_prompt}\n")

    for model_id, model_name in MODEL_MAP.items():
        print(f"[{model_id}] Testing Model: {model_name}...")
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(test_prompt)
            print(f"Response: {response.text.strip()}")
        except Exception as e:
            print(f"Error testing {model_name}: {e}")
        print("-" * 50)

if __name__ == "__main__":
    test_gemini_models()
