# =======================================================
# STAGE 1: Base image with Poetry installed
# =======================================================
FROM python:3.12 as base

# Set environment variables for Python and Poetry
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true

WORKDIR /app

# Install poetry system-wide
RUN pip install --no-cache-dir poetry

# Copy only dependency files to leverage Docker's build cache
COPY poetry.lock pyproject.toml ./
# README needed for poetry install
COPY ./README.md ./README.md

# =======================================================
# STAGE 2: CI image with development dependencies
# Used for running tests in the pipeline.
# =======================================================
FROM base as ci

ENV PATH="/app/.venv/bin:$PATH"

# Copy the rest of the application code
COPY ./src ./src
COPY ./config ./config
COPY ./muster ./muster
COPY ./tests ./tests
COPY ./db ./db
COPY ./logs ./logs

# Install all dependencies, including development ones
RUN poetry install

# =======================================================
# STAGE 3: Production image - lean and optimized
# This is the final image that gets deployed.
# =======================================================
FROM base as production

ENV PATH="/app/.venv/bin:$PATH"

# Copy the rest of the application code
COPY ./src ./src
COPY ./config ./config
COPY ./muster ./muster
COPY ./db ./db
COPY ./logs ./logs

# Install ONLY production dependencies
RUN poetry install --without dev

# Set a build-time argument for the port
ARG PORT=2320
# Set the runtime environment variable from the build-time argument
ENV PORT=$PORT

# Expose the port for documentation and networking
EXPOSE ${PORT}

# Use the shell form of CMD to allow environment variable substitution
CMD uvicorn src.main:app --port ${PORT} --host 0.0.0.0