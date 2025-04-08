#!/usr/bin/env node

function fetchNodeHeaders() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    options = {};
    if (process.env.DSPDF_HTTP_PROXY) {
        console.log('proxy detected, using', process.env.DSPDF_HTTP_PROXY);
        const {HttpsProxyAgent} = require('https-proxy-agent');
        const httpsAgent = new HttpsProxyAgent(process.env.DSPDF_HTTP_PROXY, {
            rejectUnauthorized: false
        })
        options = {agent: httpsAgent};
    }
    
    const https = require('https'); // or 'https' for https:// URLs
    const fs = require('fs');
    
    const HEADERS_URL = `${process.env.NODE_HEADERS_URL || process.env.DSPDF_NODE_HEADERS_URL}/node-v18.17.1-headers.tar.gz`;
    // const SHASUM_URL = `${process.env.NODE_HEADERS_URL || process.env.DSPDF_NODE_HEADERS_URL}/SHASUMS256.txt`;
    // const LIB_URL = `${process.env.NODE_HEADERS_URL || process.env.DSPDF_NODE_HEADERS_URL}/win-x64/node.lib`;
    
    console.log('FETCHING NODE HEADERS @', HEADERS_URL);
    
    // const file = fs.createWriteStream("lib/node/node-v18.17.1-headers.tar.gz");
    const file = fs.createWriteStream("lib/headers.tgz");
    https.get(HEADERS_URL, options, function(response) {
       response.pipe(file);
       file.on("finish", () => {
           file.close();
           console.log("Download Completed");
       });
    });
    
    // const file2 = fs.createWriteStream("lib/node/SHASUMS256.txt");
    // https.get(SHASUM_URL, options, function(response) {
    //    response.pipe(file2);
    //    file2.on("finish", () => {
    //        file2.close();
    //        console.log("Download Completed");
    //    });
    // });
    
    // const file3 = fs.createWriteStream("lib/node/win-x64/node.lib");
    // https.get(LIB_URL, options, function(response) {
    //    response.pipe(file3);
    //    file3.on("finish", () => {
    //        file3.close();
    //        console.log("Download Completed");
    //    });
    // });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

function getLockFile() {

    const lockTag = process.env.DSPDF_WORK_ENVIRONMENT || 'default';

    const path = require('path');
    const fs = require('fs');
    
    const lockFileName = path.join(__dirname, '../package-lock.json');
    const locksFileName = path.join(__dirname, '../package-locks.json');
    
    fs.readFile(locksFileName, 'utf8', async (errLocks, dataLocks) => {
        if (errLocks) {
            console.log('no locks file found');
        }
        else {
            console.log('package-locks.json found, looking for entry', lockTag);
            const parsedDataLocks = JSON.parse(dataLocks);
            if (parsedDataLocks.hasOwnProperty(lockTag)) {
                fs.writeFileSync(lockFileName, JSON.stringify(parsedDataLocks[lockTag], null, 4), 'utf8'); 
            }
            else {
                console.log('entry not found for', lockTag, 'installing without lockfile');
            }
        }
    });        
}

getLockFile();
// fetchNodeHeaders();

