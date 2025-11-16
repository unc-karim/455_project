FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application
COPY . .

# Set environment variables
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Run the application with gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:8080", "-w", "4", "--timeout", "120", "server:app"]
