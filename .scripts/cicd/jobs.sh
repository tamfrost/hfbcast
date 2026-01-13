#!/usr/bin/env bash

prepare_npmrc() {
    if [ -n "$NPMRC" ]; then
        echo found NPMRC environment variable
        echo -e ${NPMRC} | base64 -d > .npmrc
        if command -v aws >/dev/null 2>&1; then
            echo "aws cli detected, logging in to CodeArtifact"
            pwd
            ./aws_login
        fi
    else
        prepare_npmrc_gitlab_instance
    fi
}

prepare_npmrc_gitlab_instance() {
    echo "@dspdf:registry = https://${CI_SERVER_HOST}/api/v4/packages/npm/" > .npmrc
    echo "//${CI_SERVER_HOST}/api/v4/packages/npm/:_authToken=${PERSONAL_ACCESS_TOKEN}" >> .npmrc
    npm config set strict-ssl false || true
}

prepare_npmrc_gitlab_project() {
    echo "@dspdf:registry=https://${CI_SERVER_HOST}/api/v4/projects/${CI_PROJECT_ID}/packages/npm/" > .npmrc
    echo "//${CI_SERVER_HOST}/api/v4/projects/${CI_PROJECT_ID}/packages/npm/:_authToken=${PERSONAL_ACCESS_TOKEN}" >> .npmrc
    npm config set strict-ssl false || true
}

build_doc() {
    PS4=$(printf "\n\033[1;33mDOC >>\033[0m ")
    set -x

    docker run --rm -v $(pwd)/doc:/documents $IMAGE_REGISTRY_PATH_MAIN/asciidoctor/docker-asciidoctor asciidoctor -o index.html documentation.adoc

    printf "\n\033[0;32mreplacing https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9\nwith ${MATHJAX_URL}\033[0m \n"
    sed -i "s@https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9@${MATHJAX_URL}@g" doc/index.html

    # #genarate docbook
    # docker run --rm -v $(pwd)/doc:/documents $IMAGE_REGISTRY_PATH_MAIN/asciidoctor/docker-asciidoctor asciidoctor -b docbook documentation.adoc

    # #genarate pdf
    # docker run --rm -v "$(pwd)/doc:/data" --user $(id -u):$(id -g) $IMAGE_REGISTRY_PATH_MAIN/pandoc/latex -r docbook --toc -V colorlinks -V geometry:margin=25mm -V block-headings documentation.xml -o documentation.pdf

    # #genarate ms-word
    # docker run -v $(pwd)/doc:/data $IMAGE_REGISTRY_PATH_MAIN/pandoc/latex -r docbook -t docx -o documentation.docx documentation.xml
}

build_documentation() {
    PS4=$(printf "\n\033[1;33mDOC >>\033[0m ")
    set -x

    cd doc

    asciidoctor -o index.html documentation.adoc

    printf "\n\033[0;32mreplacing https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9\nwith ${MATHJAX_URL}\033[0m \n"
    sed -i "s@https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9@${MATHJAX_URL}@g" index.html
}

build_database() {
    # written for node:22.14.0
    PS4=$(printf "\n\033[1;33mDATABASE >>\033[0m ")
    set -x

    # Install Chrome dependencies for Puppeteer
    apt-get update && apt-get install -y \
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
        --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

    cd sqlite
    rm -f package-lock.json
    npm install -g ts-node
    npm install
    npm rebuild sqlite3
    npx puppeteer browsers install chrome
    npm run build
    gzip database.sqlite
    mv database.sqlite.gz ../assets
}

build_package() {
    # written for node:18.17.1
    PS4=$(printf "\n\033[1;33mPACKAGE >>\033[0m ")
    set -x

    echo running build_package

    cp .npmrc ~/.npmrc

    echo {\"commitHash\": \"${CI_COMMIT_SHORT_SHA}\"} >commithash.json

    rm -f package-lock.json
    npm install
    npm run build
    mkdir package
    npm pack --pack-destination="./package"
    node .scripts/getPackageInfo.js name >package/name.txt
    node .scripts/getPackageInfo.js version >package/version.txt
    node .scripts/getPackageInfo.js namespace >package/namespace.txt
    # cd dist
    # npm pack
}

test_package() {
    # written for node:18.17.1
    PS4=$(printf "\n\033[1;33mTEST >>\033[0m ")
    set -x

    cp .npmrc ~/.npmrc

    ls -al dist
    ls -al package
    cp dist/*.tgz ./dist-package.tgz # only works if the package is moved for some reason
    cp package/*.tgz ./demo-package.tgz
    npx --node-options=--inspect -y -p dist-package.tgz -c $(cat package/name.txt)-test &&
        npx --node-options=--inspect -y -p demo-package.tgz -c $(cat package/name.txt)-test
    rm -f dist-package.tgz demo-package.tgz
}

run_package() {
    # written for node:18.17.1
    PS4=$(printf "\n\033[1;33mRUN >>\033[0m ")
    set -x

    cp .npmrc ~/.npmrc

    # apt-get update && apt-get install -y netcat-openbsd
    ls -al package
    cp package/*.tgz ./demo-package.tgz
    /bin/bash -l -c "npm config set strict-ssl false && npx --node-options=--inspect -y demo-package.tgz -p 8080"
}

publish_package() {
    # written for node:18.17.1
    PS4=$(printf "\n\033[1;33mPUBLISH >>\033[0m ")
    set -x

    cp .npmrc ~/.npmrc

    cp dist/*.tgz ./dist-package.tgz
    cat .npmrc
    npm publish dist-package.tgz
    rm -f dist-package.tgz
}

build_publish_image() {
    PS4=$(printf "\n\033[1;33mIMAGE >>\033[0m ")
    set -x

    cp .npmrc ~/.npmrc

    PACKAGE_VERSION=$(cat package/version.txt)
    PACKAGE_NAME=$(cat package/name.txt)

    IMAGE_NAME=$CI_REGISTRY_IMAGE:latest

    mv .npmrc package/.

    printf "\n\033[0;35mBUILDING IMAGE $IMAGE_NAME FROM $IMAGE_REGISTRY_PATH WITH NODE HEADERS @ $NODE_HEADERS_URL\033[0m \n"

    docker login -u $CI_REGISTRY_USER -p $PERSONAL_ACCESS_TOKEN $CI_REGISTRY
    docker build --build-arg IMAGE_REGISTRY_PATH=$IMAGE_REGISTRY_PATH --build-arg NODE_HEADERS_URL=$NODE_HEADERS_URL -t $IMAGE_NAME --progress=plain --no-cache .
    docker system prune -f
    docker images

    printf "\n\033[0;35mPUBLISHING IMAGE AT $CI_REGISTRY $CI_REGISTRY_IMAGE\033[0m \n"
    docker push $IMAGE_NAME

    # chmod 600 $SSHKEY_APP_SERVER;
    # ssh -o StrictHostKeyChecking=no -i $SSHKEY_APP_SERVER dspdf@dspdf.sys.utv ./deploy_image.sh $APP_NAME $IMAGE_NAME;
}

deploy_image() {
    PS4=$(printf "\n\033[1;33mDEPLOY >>\033[0m ")
    set -x
    # written for node:18.17.1

    PACKAGE_VERSION=$(cat package/version.txt)
    PACKAGE_NAME=$(cat package/name.txt)
    IMAGE_NAME=$CI_REGISTRY/dspdf/$PACKAGE_NAME:latest

    printf "\n\033[0;32mDEPLOYING IMAGE $IMAGE_NAME\033[0m \n"

    chmod 600 $SSHKEY_APP_SERVER

    ssh -o StrictHostKeyChecking=no -i $SSHKEY_APP_SERVER dspdf@dspdf.sys.utv sudo podman-compose -f compose/$PACKAGE_NAME.yml pull
    ssh -o StrictHostKeyChecking=no -i $SSHKEY_APP_SERVER dspdf@dspdf.sys.utv sudo podman-compose -f compose/$PACKAGE_NAME.yml up -d
    ssh -o StrictHostKeyChecking=no -i $SSHKEY_APP_SERVER dspdf@dspdf.sys.utv sudo podman images
    ssh -o StrictHostKeyChecking=no -i $SSHKEY_APP_SERVER dspdf@dspdf.sys.utv sudo podman ps -a
}

# build-image() {
# # written for docker:20.10.16-dind
#     echo BUILDING IMAGE;
#     ls -al package;
#     docker login -u $CI_REGISTRY_USER -p $PERSONAL_ACCESS_TOKEN $CI_SERVER_HOST;
#     docker build -t registry.$CI_SERVER_HOST/dspdf/$CI_PROJECT_TITLE:latest --progress=plain --build-arg PACKAGE_NAME=$CI_PROJECT_TITLE --no-cache .;
#     docker images;
#     docker push registry.$CI_SERVER_HOST/dspdf/$CI_PROJECT_TITLE:latest;
# }

# build-native() {
# }

# build-documentation() {
# }

if [ -f "cert.cer" ]; then
    export ADDITIONAL_CERTIFICATE=$(cat cert.cer)
fi
