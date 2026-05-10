import os
import sys

from dotenv import load_dotenv
load_dotenv()

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"\n🚀  NewsIntel starting on http://localhost:{port}\n")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        app_dir="backend",
    )