FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV headless and PyTorch/rembg runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Set up write permissions for uploads, results, and rembg cache (UID 1000 compatibility)
RUN mkdir -p app/uploads app/results /.u2net /.cache && \
    chmod -R 777 /app /.u2net /.cache

# Expose port (7860 is default for Hugging Face Spaces, Render uses $PORT)
EXPOSE 7860

# Start server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]

