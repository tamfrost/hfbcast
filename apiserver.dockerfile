# Build stage: install production dependencies only
FROM node:22.14.0-bookworm-slim AS deps

WORKDIR /app

# Trust corporate CA certificates (TLS-intercepting proxy).
# The certs/ directory is populated from the build host's
# /usr/local/share/ca-certificates and added here so npm can reach
# the registry over HTTPS. This only affects the build stage.
COPY certs ./certs
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    if [ -d certs ] && [ "$(ls -A certs/*.crt certs/*.pem 2>/dev/null)" ]; then \
        cp certs/*.crt certs/*.pem /usr/local/share/ca-certificates/ 2>/dev/null || true; \
        update-ca-certificates; \
    fi && \
    rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Install dependencies using the lockfile so the exact versions that
# already resolved on the host are used (the corporate npm mirror may
# lag behind the public registry for freshly-published packages).
# --omit=dev excludes webpack, jest, puppeteer and other dev tooling.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Final image: standalone apiserver with database included
FROM node:22.14.0-bookworm-slim

WORKDIR /app

# Copy installed production node_modules from the build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the Express server and its database access layer
COPY server.js ./
COPY database.js ./
COPY package.json ./

# Copy static frontend served by express.static('/')
COPY public ./public

# Copy the pre-built database that database.js loads from ./assets
COPY assets ./assets

# server.js listens on port 8000 (bound to 0.0.0.0)
EXPOSE 8000

CMD [ "node", "server.js" ]
