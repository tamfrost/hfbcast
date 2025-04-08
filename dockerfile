ARG IMAGE_REGISTRY_PATH
FROM $IMAGE_REGISTRY_PATH/node:18.17.1
WORKDIR /app

COPY package .

ARG NODE_HEADERS_URL

RUN mv .npmrc ~/. && \
npm config set strict-ssl false && \
npm install -g `ls *.tgz`

EXPOSE 8080

CMD [ "hfbcast-runserver" ]
