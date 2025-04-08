#!/usr/bin/env node

const log4js = require("log4js");

function server(config, silent) {

    const express = require('express')
    const path = require('path')
    const cors = require('cors')
    const app = express()

    const logger = log4js.getLogger();
    logger.level = silent ? 'fatal' : 'debug';

    let resolver, rejecter;

    app.use(express.json())
    app.use(cors());
    app.options('*', cors());

    // //allowing for use of sharedArrayBuffers
    // app.use((req, res, next) => {
    //     res.setHeader("Cross-Origin-Opener-Policy", "same-origin"); 
    //     // res.setHeader("Cross-Origin-Embedder-Policy", "same-origin"); 
    //     next();
    // })

    //******************************
    //     serve static content
    //******************************

    app.use(express.static(path.resolve(__dirname, 'dist')));
    // app.use('/doc/mathjax', express.static(path.resolve(__dirname, 'lib/mathjax')));
    app.use('/doc', express.static(path.resolve(__dirname, 'doc')));

    //******************************
    //          REST
    //******************************

    app.get('/api/v1/resource/:parameter', (req, res, next) => {
        reqURL = new URL(req.url, 'http://' + req.headers.host + '/');


        res.json({
            parameter: req.params.parameter,
            queryVar1: reqURL.searchParams.get('var1'),
            queryVar2: reqURL.searchParams.get('var2'),
        })
    })

    app.post('/api/v1/resource', (req, res, next) => {
        res.json({requestBody: req.body});
    })

    //******************************
    //          proxy
    //******************************

    const { createProxyMiddleware } = require('http-proxy-middleware');

    app.use('/jsontest',
        createProxyMiddleware({
        target: 'http://echo.jsontest.com/',
        changeOrigin: true,
        pathRewrite: {
            '^/jsontest':''
        }
        }),
    );

    //*********************************************************************
    //     set up web sockets (all on the same port as the http server)
    //*********************************************************************

    const server = require('http').createServer();

    server.on('request', app);

    server.on('error', e => {
        logger.info(e);
        rejecter('server error');
    });

    server.listen(8080, () => {
        logger.info('app server listening on http://localhost:8080')
        resolver('server started');
    })

    return new Promise((resolve, reject) => {
        resolver = resolve;
        rejecter = reject;
    });
}

const yargs = require('yargs')
    .usage('npm start -- -c <config file> -s <silent>')
    .options({
        config: {
            alias: 'c',
            describe: 'config file',
        },
        silent: {
            alias: 's',
            describe: 'run without logging',
        }
    })
    .argv;

if (require.main === module) {
    server(yargs.config ? require('./' + yargs.config) : {}, yargs.silent)
    .then(message => {
        console.log(message);
    })
    .catch(message => {
        console.error(message);
    });
}

module.exports = {
    server
};

