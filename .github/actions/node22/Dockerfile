FROM node:22.14.0-bookworm-slim

# Set environment variables for npm global installation
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$NPM_CONFIG_PREFIX/bin:$PATH

# Create the directory for global installations
RUN mkdir -p /home/node/.npm-global && \
    chown -R node:node /home/node/.npm-global

USER node