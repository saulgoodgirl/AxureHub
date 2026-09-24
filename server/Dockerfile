FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROTOTYPES_DIR=/srv/prototypes \
    PORT=8088

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py axurehub.html ./

# Create prototypes storage directory
RUN mkdir -p /srv/prototypes

EXPOSE 8088

CMD ["python", "app.py"]
