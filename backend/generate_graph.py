import os
import sys

# Add the current directory to sys.path to ensure 'app' can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app.services.langgraph.graph import csagent_graph
    print("🚀 LangGraph structure loaded successfully.")
except ImportError as e:
    print(f"❌ Error: Could not import LangGraph. Ensure you are running this from the 'backend' directory. Details: {e}")
    sys.exit(1)

def generate_png():
    output_path = "langgraph_structure.png"
    print(f"🎨 Generating graph structure...")
    
    try:
        # Get the graph and draw as PNG
        graph = csagent_graph.get_graph()
        image_bytes = graph.draw_mermaid_png()
        
        with open(output_path, "wb") as f:
            f.write(image_bytes)
            
        print(f"✅ Success! Graph saved to: {os.path.abspath(output_path)}")
        
    except Exception as e:
        print(f"❌ Failed to generate graph: {e}")
        print("\nNote: draw_mermaid_png() typically requires an internet connection (to call mermaid.ink) "
              "or local dependencies like pygraphviz/mermaid-python.")

if __name__ == "__main__":
    generate_png()
