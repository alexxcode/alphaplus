FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (required for some OpenCV functions even in headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port (local port used by alpha plus proxy)
EXPOSE 8100

CMD ["uvicorn", "metrology_service:app", "--host", "0.0.0.0", "--port", "8100"]
