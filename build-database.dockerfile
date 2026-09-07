FROM node:22.14.0-bookworm AS appbuild

ARG COMMIT_SHA=default
ARG APP_VERSION=0.0.0
ENV CI_COMMIT_SHORT_SHA=$COMMIT_SHA
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY . .

# Copy and install custom CA certificates (if they exist)
RUN mkdir -p /tmp/certs && \
    if [ -d "certs" ] && [ "$(ls -A certs/*.pem certs/*.crt 2>/dev/null)" ]; then \
        cp certs/*.pem certs/*.crt /tmp/certs/ 2>/dev/null || true; \
    fi && \
    if [ "$(ls -A /tmp/certs 2>/dev/null)" ]; then \
        cat /tmp/certs/* >> /etc/ssl/certs/ca-certificates.crt && \
        cat /tmp/certs/* > /tmp/custom-ca-certs.pem && \
        npm config set -g cafile /etc/ssl/certs/ca-certificates.crt && \
        npm config set -g proxy $HTTP_PROXY && \
        npm config set -g https-proxy $HTTPS_PROXY && \
        export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt; \
    fi && \
    rm -rf /tmp/certs

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Build database inline
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils && \
    rm -rf /var/lib/apt/lists/*

# Re-add custom CA certificates after apt-get install
RUN if [ -f /tmp/custom-ca-certs.pem ]; then \
        cat /tmp/custom-ca-certs.pem >> /etc/ssl/certs/ca-certificates.crt && \
        npm config set -g cafile /etc/ssl/certs/ca-certificates.crt && \
        npm config set -g proxy $HTTP_PROXY && \
        npm config set -g https-proxy $HTTPS_PROXY && \
        export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && \
        export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt; \
    fi

# Build database
RUN cd sqlite && \
    rm -f package-lock.json && \
    npm install -g ts-node && \
    npm install && \
    npm rebuild sqlite3 && \
    npx puppeteer browsers install chrome

CMD [ "sh", "-c", "npm run build && gzip database.sqlite && mv database.sqlite.gz ../../database/database.sqlite.gz" ]
