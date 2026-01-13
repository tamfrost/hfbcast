#=====================================================
# build documentation
#=====================================================
FROM asciidoctor/docker-asciidoctor AS docbuild

ARG COMMIT_SHA=default
ARG APP_VERSION=0.0.0
ENV CI_COMMIT_SHORT_SHA=$COMMIT_SHA
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY . .

SHELL ["/bin/bash", "-c"]

RUN source .scripts/cicd/jobs.sh; build_documentation 

#=====================================================
# build database and application
#=====================================================
FROM node:22.14.0-bookworm AS appbuild

ARG COMMIT_SHA=default
ARG APP_VERSION=0.0.0
ENV CI_COMMIT_SHORT_SHA=$COMMIT_SHA
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY --from=docbuild /app .

SHELL ["/bin/bash", "-c"]

RUN cd /app && source .scripts/cicd/jobs.sh && build_database
RUN cd /app && source .scripts/cicd/jobs.sh && build_package

#=====================================================
# build final image
#=====================================================
FROM node:22.14.0-bookworm-slim

ARG COMMIT_SHA=default
ARG APP_VERSION=0.0.0
ENV CI_COMMIT_SHORT_SHA=$COMMIT_SHA
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY --from=appbuild /app/package .

RUN npm config set strict-ssl false && \
npm install -g `ls *.tgz`

EXPOSE 8080

CMD [ "hfbcast-runserver" ]
