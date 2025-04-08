#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const lockFileName = path.join(__dirname, '../package-lock.json');
const locksFileName = path.join(__dirname, '../package-locks.json');

function deleteFile(file) {
    fs.unlink(file, (err) => {
        if (err) {
            console.log('Error deleting', file, err);
        }
        else {
            console.log(file, 'deleted');
        }
    });
}

function setLockFile () {

    const lockTag = process.env.DSPDF_WORK_ENVIRONMENT || 'default';

    fs.readFile(lockFileName, 'utf8', (errLock, dataLock) => {
        if (errLock) {
            console.log('package-lock.json not found, installation must have failed');
        }
        else {
            const packageLock = JSON.parse(dataLock);
            console.log('package-lock.json found, checking for', locksFileName);

            const lines = dataLock.split('\n');
            const matchingLines = lines.filter(line => line.includes('geolob'));
            matchingLines.forEach(line => console.log('LLLLLLLLLL', line));

            fs.readFile(locksFileName, 'utf8', (errLocks, dataLocks) => {
                if (errLocks) {
                    console.warn('creating a new package-locks.json file with entry for', lockTag);
                    const packageLocksEntry = {[lockTag]: packageLock};
                    fs.writeFileSync(locksFileName, JSON.stringify({...packageLocksEntry}, null, 4), 'utf8'); 
                    deleteFile(lockFileName);
                }
                else {
                    console.log('package-locks.json found, updating');
                    const locks = JSON.parse(dataLocks);
                    locks[lockTag] = packageLock;
                    fs.writeFileSync(locksFileName, JSON.stringify(locks, null, 4), 'utf8'); 
                    deleteFile(lockFileName);
                }
            });        
        }
    });
}

setLockFile();