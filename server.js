#!/usr/bin/env node

const log4js = require("log4js");
const express = require('express')
const path = require('path')
const cors = require('cors')
const app = express()

const db = require('./database')

const logger = log4js.getLogger();

function server(config, silent) {    

    logger.level = silent ? 'fatal' : 'debug';

    let resolver, rejecter;

    app.use(express.json())
    app.use(cors());
    app.options('*', cors());

    db.initDb(logger)

    // server static homepage content
    app.use('/', express.static(path.join(__dirname, 'public')));

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

    app.get("/api/v1/broadcast", (req, res) => {
        const result = db.findBetweenFrequencies(120.1, "lol")
        if (!result) {
            return res.status(404).json({
                error: "Failed to query database"
            })
        }
        res.json({result})
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

    const httpServer = require('http').createServer();

    httpServer.on('request', app);
    httpServer.on('error', e => {
        logger.info(e);
        rejecter('server error');
    });
    httpServer.listen(8080, () => {
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

