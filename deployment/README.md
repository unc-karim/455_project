# Deployment Guide

## Google Cloud Run Deployment

This guide explains how to deploy the Elliptic Curve Calculator to Google Cloud Run.

### Prerequisites

1. **Google Cloud SDK**: Install and configure the gcloud CLI
   ```bash
   # Install gcloud SDK
   # Follow: https://cloud.google.com/sdk/docs/install
   
   # Authenticate
   gcloud auth login
   
   # Set your project (replace with your actual project ID)
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable Required APIs**:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

### Deployment Steps

1. **Set Required Environment Variables**:
   ```bash
   export PROJECT_ID="your-gcp-project-id"
   export REGION="us-central1"  # or your preferred region
   export SERVICE_NAME="ecc-calculator"  # or your preferred service name
   ```

2. **Optional: Set Flask Secret Key** (recommended for production):
   ```bash
   export FLASK_SECRET_KEY="your-secure-random-secret-key"
   ```
   Generate a secure key with:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Deploy the Application**:
   ```bash
   # From the project root directory
   ./deployment/deploy.sh
   
   # Or with inline environment variables
   PROJECT_ID=your-project REGION=us-central1 SERVICE_NAME=ecc-calculator ./deployment/deploy.sh
   ```

### What Happens During Deployment

1. **Build**: The script builds a Docker container image using Google Cloud Build
2. **Push**: The image is pushed to Google Container Registry (gcr.io)
3. **Deploy**: The image is deployed to Cloud Run with the specified configuration

### After Deployment

Once deployment is complete, you'll see output like:
```
Service [ecc-calculator] revision [ecc-calculator-00001-xxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://ecc-calculator-xxxxx-uc.a.run.app
```

Visit the Service URL to access your deployed application.

### Configuration

#### Environment Variables

The following environment variables can be set during deployment:

- `FLASK_SECRET_KEY`: Secret key for Flask sessions (auto-generated if not provided)
- `DB_PATH`: Path to the SQLite database file (default: `/app/app.db`)

#### Dockerfile

The Dockerfile is located at `deployment/Dockerfile` and includes:
- Python 3.11 slim base image
- Gunicorn WSGI server with 4 workers
- 120-second timeout for long-running requests
- Port 8080 (Cloud Run standard)

### Updating the Deployment

To update an existing deployment, simply run the deploy script again:
```bash
PROJECT_ID=your-project ./deployment/deploy.sh
```

Cloud Run will create a new revision and route traffic to it automatically.

### Local Testing with Docker

Before deploying, you can test the Docker container locally:

```bash
# Build the image
docker build -f deployment/Dockerfile -t ecc-calculator .

# Run the container
docker run -p 8080:8080 -e FLASK_SECRET_KEY=test-key ecc-calculator

# Access at http://localhost:8080
```

### Troubleshooting

#### "Dockerfile required when specifying --tag"
- **Cause**: The gcloud command can't find the Dockerfile
- **Solution**: Ensure you're running the script from the project root, or that the `--file` flag points to the correct Dockerfile location

#### "Permission denied" errors
- **Cause**: Missing API permissions or incorrect project configuration
- **Solution**: 
  - Verify you have the necessary roles (Cloud Run Admin, Storage Admin)
  - Enable required APIs (see Prerequisites)
  - Check `gcloud config get-value project` matches your PROJECT_ID

#### Build failures
- **Cause**: Missing dependencies or syntax errors
- **Solution**: Test locally with Docker first to verify the build works

### Cost Considerations

Cloud Run pricing is based on:
- **Request time**: Billed per 100ms increments
- **CPU allocation**: Billed during request processing
- **Memory allocation**: Billed during request processing
- **Network egress**: Outbound data transfer

With Cloud Run's free tier, you get:
- 2 million requests per month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds of compute time

For most small to medium applications, this is sufficient to run for free.

### Production Considerations

For production deployments, consider:

1. **Database**: Migrate from SQLite to Cloud SQL (PostgreSQL/MySQL) for better scalability
2. **Secrets Management**: Use Google Secret Manager instead of environment variables
3. **Custom Domain**: Map a custom domain to your Cloud Run service
4. **Monitoring**: Enable Cloud Logging and Cloud Monitoring
5. **CI/CD**: Set up automated deployments with Cloud Build triggers

### Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Flask on Cloud Run](https://cloud.google.com/python/docs/run)
