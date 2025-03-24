FROM node:23-bullseye

# Base dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0 \
    xvfb \
    sudo

WORKDIR /app

RUN npm install -g pnpm

COPY package.json /app/package.json
COPY tsconfig.json /app/tsconfig.json

# Install packages and Google Chrome
RUN pnpm i && pnpm in-chrome

# Cleanup package caches
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Force use of Google Chrome
# DO NOT USE 'chromium' !!!
# On production, Google Chrome is highly recommended
ENV USE_GOOGLE_CHROME=true

COPY ./src /app/src

# Ensure we have a non-root user
RUN groupadd -r appuser && useradd -r -g appuser -G audio,video appuser
RUN mkdir -p /home/appuser && chown -R appuser:appuser /home/appuser /app

# Set display environment variables
ENV DISPLAY=:0
ENV WAYLAND_DISPLAY=wayland-0

# Max concurrency for requests
ENV QUEUE_CONCURRENCY=5

# Switch to non-root user
USER appuser

CMD ["pnpm", "prod"]