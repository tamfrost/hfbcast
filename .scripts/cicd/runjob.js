#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const Docker = require('dockerode');
const { rimraf } = require('rimraf');
const { glob } = require('glob');
const projectName = require('../../package.json').name.split('/').pop();

let chalk;
import('chalk').then(({ default: chlk }) => {
    chalk = chlk;
});

var docker = new Docker();

console.log(projectName);

function splitmod(str, delimiter) {
    const index =  str.indexOf(delimiter);
    if (index === -1) {
        return [str]
    }
    return [str.slice(0, index), str.slice(index + delimiter.length)]
}

function createEnv() {
    let envFile = '';
    Object.entries({
        ...process.env, ...{
            DSPDF_CI_COMMIT_SHORT_SHA: 'abcd1234',
            DSPDF_CI_PROJECT_ID: process.env['DSPDF_CI_PROJECT_ID_' + projectName.toUpperCase()],
            DSPDF_CI_REGISTRY_IMAGE: process.env.DSPDF_IMAGE_ARTIFACT_PATH + '/' + projectName
        }
    }).filter(([name, value]) => name.startsWith('DSPDF_')).forEach(([name, value]) => {
        envFile += `${splitmod(name, 'DSPDF_')[1]}=${value}\n`
    })
    fs.writeFile(path.resolve(__dirname, 'env.txt'), envFile, (err) => {
        if (err) {
            console.error('Error creating env.txt file:', err);
        } else {
            console.log('env.txt file created successfully');
        }
    });
}

function deletEnv() {
    fs.unlink(path.resolve(__dirname, 'env.txt'), (err) => {
        if (err) {
            console.error('Error deleting env.txt file:', err);
        } else {
            console.log('env.txt file deleted successfully');
        }
    });
}

async function dindStatus() {
    const containers = await docker.listContainers({ all: true });
    return new Promise((resolve, reject) => {
        const dindContainers = containers.filter(containerInfo => containerInfo.Names[0].includes('docker-dind-' + projectName));
        if (dindContainers.length === 1) {
            resolve({ created: true, running: dindContainers[0].State === 'running' });
        } else {
            resolve({ created: false, running: false });
        }
    });
}

async function runDind() {
    return new Promise((resolve, reject) => {
        const command = `docker run -d --privileged --env-file ${path.resolve(__dirname, 'env.txt')} -v ${path.resolve(__dirname, '../../')}:/code -w /code --name docker-dind-${projectName} ${process.env.DSPDF_IMAGE_REGISTRY_PATH_MAIN}/docker:20.10.16-dind --insecure-registry=docker.sys.utv --insecure-registry=gitlab.sys.utv:4567`
        const child = shell.exec(command);
        setTimeout(() => { resolve('ready') }, 5000);
    })
}

async function startStopDind(value) {
    return new Promise((resolve, reject) => {
        const command = `docker ${value} docker-dind-${projectName}`
        const child = shell.exec(command);
        setTimeout(() => { resolve('ready') }, 5000);
    })
}

const yargs = require('yargs')
    .usage('npm start -- -c <config file> -s <silent>')
    .options({
        type: {
            alias: 't',
            describe: 'type of job to run',
            choices: ['doc', 'wasm', 'package', 'database', 'test', 'run', 'publish', 'image', 'deploy', 'clean'],
        }
    })
    .argv;

if (yargs.type === 'clean') {
    yargs.files.split(':').forEach(file => {
        const filePath = path.resolve(__dirname, '../../', file);
        glob(filePath.replace(/\\/g,'/'))
        .then(f => {
            rimraf(f)
                .then(() => console.log(filePath, 'removed'))
                .catch((e) => console.log(f, 'error', e));
        })
    });
}
else {

    createEnv();

    console.log('running for:', yargs.type);

    const typeMap = {
        doc: {
            dockerCommand: 'exec',
            rm: '',
            mount: '',
            image: 'docker-dind-' + projectName,
            shell: 'sh',
            command: 'cd /code && . .scripts/cicd/jobs.sh; build_doc',
            dind: true,
            clean: ['doc/index.html']
        },
        wasm: {
            dockerCommand: 'run',
            rm: '--rm',
            mount: `-v ${path.resolve(__dirname, '../../')}:/code -w /code`,
            portmap: '',
            image: process.env.DSPDF_IMAGE_REGISTRY_PATH + '/dspdf-wasm:latest',
            shell: 'bash',
            command: 'cd /code && source .scripts/cicd/jobs.sh; build_wasm',
            dind: false,
            clean: []
        },
        database: {
            dockerCommand: 'run',
            rm: '--rm',
            mount: `-v ${path.resolve(__dirname, '../../')}:/code -w /code`,
            portmap: '',
            image: process.env.DSPDF_IMAGE_REGISTRY_PATH_MAIN + '/node:18.17.1',
            shell: 'bash',
            command: 'cd /code && source .scripts/cicd/jobs.sh; build_database',
            dind: false,
            clean: []
        },
        package: {
            dockerCommand: 'run',
            rm: '--rm',
            mount: `-v ${path.resolve(__dirname, '../../')}:/code -w /code`,
            portmap: '',
            image: process.env.DSPDF_IMAGE_REGISTRY_PATH_MAIN + '/node:18.17.1',
            shell: 'bash',
            command: 'cd /code && source .scripts/cicd/jobs.sh; build_package',
            dind: false,
            clean: ['package', 'build', 'dist/*.tgz', 'dist/*.min.js*', 'dist/*.html']
        },
        test: {
            dockerCommand: 'run',
            rm: '--rm',
            mount: `-v ${path.resolve(__dirname, '../../')}:/code -w /code`,
            portmap: '',
            image: process.env.DSPDF_IMAGE_REGISTRY_PATH + '/node:18.17.1',
            shell: 'bash',
            command: 'cd /code && source .scripts/cicd/jobs.sh; test_package',
            dind: false,
            clean: []
        },
        run: {
            dockerCommand: 'run',
            rm: '--rm',
            mount: `-v ${path.resolve(__dirname, '../../')}:/code -w /code`,
            portmap: '-p 8080:8080',
            image: process.env.DSPDF_IMAGE_REGISTRY_PATH_MAIN + '/node:18.17.1',
            shell: 'bash',
            command: 'cd /code && source .scripts/cicd/jobs.sh; run_package',
            dind: false,
            clean: []
        },
        publish: {
            dockerCommand: 'run',
            rm: '--rm',
            mount: `-v ${path.resolve(__dirname, '../../')}:/code -w /code`,
            portmap: '',
            image: process.env.DSPDF_IMAGE_REGISTRY_PATH_MAIN + '/node:18.17.1',
            shell: 'bash',
            command: 'cd /code && source .scripts/cicd/jobs.sh; publish_package',
            dind: false,
            clean: []
        },
        image: {
            dockerCommand: 'exec',
            rm: '',
            mount: '',
            image: 'docker-dind-' + projectName,
            shell: '/bin/sh',
            command: 'cd /code && source .scripts/cicd/jobs.sh; build_publish_image',
            dind: true,
            clean: []
        },
        deploy: {
            dockerCommand: 'run',
            rm: '--rm',
            mount: `-v ${path.resolve(__dirname, '../../')}:/code -w /code`,
            image: process.env.DSPDF_IMAGE_REGISTRY_PATH_MAIN + '/node:18.17.1',
            shell: 'bash',
            command: 'cd /code && source .scripts/cicd/jobs.sh; deploy_image',
            dind: false,
            clean: []
        },
    }

    const args = [
        typeMap[yargs.type].dockerCommand,
        typeMap[yargs.type].rm,
        typeMap[yargs.type].mount,
        typeMap[yargs.type].portmap,
        `--env-file ${path.resolve(__dirname, 'env.txt')}`,
        typeMap[yargs.type].image,
        typeMap[yargs.type].shell,
        `-c "${typeMap[yargs.type].command}"`
    ]

    console.log('docker ' + args.join(' '));

    (async () => {

        for (i=0; i<typeMap[yargs.type].clean.length; i++) {
            file=typeMap[yargs.type].clean[i];
            const filePath = path.resolve(__dirname, '../../', file);
            await rimraf(await glob(filePath.replace(/\\/g,'/')));
        };

        if (yargs.clean) {
            console.log('cleaned', yargs.type);
            process.exit(0);
        }

        if (typeMap[yargs.type].dind) {
            const { created, running } = await dindStatus();
            if (!created) {
                console.log('no dind found, running');
                await runDind();
            }
            else {
                if (!running) {
                    console.log('dind stopped, starting');
                    await startStopDind('start');
                }
            }
        }

        const child = shell.exec('docker ' + args.join(' '), { async: true, silent: true });

        child.stdout.on('data', (data) => {
            process.stdout.write(chalk.green('...... ' + data));
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(chalk.magenta('...... ' + data));
        });

        child.on('close', async (code) => {
            console.log(`child process exited with code ${code}`);
            if (typeMap[yargs.type].dind) await startStopDind('stop');
            deletEnv();
        });

    })()

}
