#=====================================================
# build documentation
#=====================================================
FROM asciidoctor/docker-asciidoctor AS docbuild

ARG COMMIT_SHA=default
ARG APP_VERSION=0.0.0
ENV CI_COMMIT_SHORT_SHA=$COMMIT_SHA
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY doc ./doc

# Build documentation inline
RUN cd doc && \
    asciidoctor -o index.html documentation.adoc

#=====================================================
# build database and application
#=====================================================
FROM node:22.14.0-bookworm AS appbuild

ARG COMMIT_SHA=default
ARG APP_VERSION=0.0.0
ENV CI_COMMIT_SHORT_SHA=$COMMIT_SHA
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY . .
COPY --from=docbuild /app/doc ./doc

# Copy and install custom CA certificates
COPY certs/*.pem certs/*.crt /tmp/certs/
RUN cat /tmp/certs/* >> /etc/ssl/certs/ca-certificates.crt && \
    cat /tmp/certs/* > /tmp/custom-ca-certs.pem && \
    npm config set -g cafile /etc/ssl/certs/ca-certificates.crt && \
    npm config set -g proxy $HTTP_PROXY && \
    npm config set -g https-proxy $HTTPS_PROXY && \
    rm -rf /tmp/certs

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Build database inline
RUN apt-get update && apt-get install -y \
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
        xdg-utils \
        --no-install-recommends && \
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
    npx puppeteer browsers install chrome && \
    npm run build && \
    gzip database.sqlite && \
    mv database.sqlite.gz ../assets

# Build application (webpack)
RUN echo "{\"commitHash\": \"${CI_COMMIT_SHORT_SHA}\"}" > commithash.json && \
    rm -f package-lock.json && \
    npm install && \
    npm run build

#=====================================================
# final image
#=====================================================
FROM node:22.14.0-bookworm-slim

ARG COMMIT_SHA=default
ARG APP_VERSION=0.0.0
ENV CI_COMMIT_SHORT_SHA=$COMMIT_SHA
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

# Copy built application
COPY --from=appbuild /app/dist ./dist
COPY --from=appbuild /app/doc ./doc
COPY --from=appbuild /app/assets ./assets
COPY --from=appbuild /app/server.js ./server.js
COPY --from=appbuild /app/index.js ./index.js
COPY --from=appbuild /app/commithash.json ./commithash.json
COPY --from=appbuild /app/package.json ./package.json
COPY --from=appbuild /app/node_modules ./node_modules

EXPOSE 8080

CMD [ "node", "server.js" ]
