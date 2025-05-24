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
            DSPDF_CI_REGISTRY_IMAGE: process.env.DSPDF_IMAGE_ARTIFACT_PATH + '/' + projectName,
            DSPDF_NPMRC: "QGRzcGRmOnJlZ2lzdHJ5PWh0dHBzOi8vZ2l0bGFiLmNvbS9hcGkvdjQvcGFja2FnZXMvbnBtLwovL2dpdGxhYi5jb20vYXBpL3Y0L3BhY2thZ2VzL25wbS86X2F1dGhUb2tlbj1nbHBhdC14WFdGaTY0a1NzX3lfdEt2QjFtYQpAdGFtZnJvc3Q6cmVnaXN0cnk9aHR0cHM6Ly9ucG0ucGtnLmdpdGh1Yi5jb20vCi8vbnBtLnBrZy5naXRodWIuY29tLzpfYXV0aFRva2VuPWdocF9KcHBYcThQbDBIdnI1NUszU2ZrOG1UcVJ2T0pia1UwV2w1M3oKcmVnaXN0cnk9aHR0cHM6Ly9mcmEtMDA3OTExNzc5MjQ5LmQuY29kZWFydGlmYWN0LmV1LW5vcnRoLTEuYW1hem9uYXdzLmNvbS9ucG0vdGYtbnBtLXJlcG8vCi8vZnJhLTAwNzkxMTc3OTI0OS5kLmNvZGVhcnRpZmFjdC5ldS1ub3J0aC0xLmFtYXpvbmF3cy5jb20vbnBtL3RmLW5wbS1yZXBvLzphbHdheXMtYXV0aD10cnVlCi8vZnJhLTAwNzkxMTc3OTI0OS5kLmNvZGVhcnRpZmFjdC5ldS1ub3J0aC0xLmFtYXpvbmF3cy5jb20vbnBtL3RmLW5wbS1yZXBvLzpfYXV0aFRva2VuPWV5SjJaWElpT2pFc0ltbHpkU0k2TVRjME9EQTRPREl3Tml3aVpXNWpJam9pUVRFeU9FZERUU0lzSW5SaFp5STZJa1ZDYXprNVZVMUVWRU5UVkMxSWRtVmxWSFpSVEhjaUxDSmxlSEFpT2pFM05EZ3hNekUwTURZc0ltRnNaeUk2SWtFeE1qaEhRMDFMVnlJc0ltbDJJam9pVXpod1dDMDJVRkYzZGpaeFp6aEpUaUo5LkFrVU42ZFNXaWo2eWEwN0RleTF6V2cuNE1Vem1tcHNlblRDOTMtMi5kemxwOEZpS29GZ18weWZObS1FcUJnaTlfSDBDX0xjWm1VcXVBUnNxVldJLUxuZDBINVF6d0lwdm1fYUE3MzBvNDFnMEp2QWFWakZJZ0l2WW1samlUWDdxVHV0bm5MbVJTcEhYamRJSXhmQWduV08xMlYtanNCdlM5WDRhaVpqU0dqWjFEcnBtUl9Wd0NDU0ZCcUZnTWhXbTdqUEM1dks4dTdhREl1ZHAxQkhtR0c4UjItaW10cjFicXVsMm4zX2g4RUtMdzBwNFpBaFlpclVFYVJJVXVneWs3M1RzV3dXRmpweGk3VmJxUDZtdTRPanZpTTU3dldTWDZwWmdjRTJFbTJpZlN4OGRZQWRfR2F0RTJHRlFMTDNaNnRaMlRmQ2lEVG5zdGZTYl9RUGRlZjlTcjB2Z3kxM2l5RVVGZzdUNXEtYm02MGRILXlyVjdUZ1ZZLVdNcW1KNWp1NDRldm1Yak9jdUprUU1aTnpKemlQYXN5RnJsQjA2WEJ5c3R4QlBjY2dSWklaZG92aDdpbFBXd0NHVVJ2T1NteFRUU3pZQmdMUFFibUtZZWJhQnlQd0pkWFVFTTRCOG83U3ZiZmg5bENMUFU3OFgwclZyYWJkUnNBc2xublZ5bkotOTV0V1Rqc0hpREdfaWdFQ0k5Vk5fRkY4QzdNdVB3S0FqeVQ0Um9iSXI5UlFrSFRERHNUZlVKUXc2enczczRld1huNndkM2ZxOEpCV0s5UjhhWkRIRUdrUWxHOGpwODNLalNRZ3lPajM2ZmpKYm1WbDZaem5ENzkwMXhnaE5JQXpjOGkzQnEwak5pOUstcDB0Q3VYOEFxUTVkazlKUGlYM0V0V0JFZFd4R3BUOW9UQ2RxUExRYXFSdnFoeE9sMm9yOVVxOXh2ZTluWFp6eUtBYVJUbXl5dGFSTU1za1ZLTmh4cVpHMWNPQi1nY3VKZ3RlNWpLZ2ZXTF9KUlFwcTFBVThZdWU3RXRqQ3lVTXNNV3dmNUhJLW5NNHBFM1FRa1FZRVJVbTZsS2RxUEhFN2haODdOT0p6N2tTMVI1aGp4d3huSXJzZ3Y3VGVEclE2eURnWXdFOG5BUUlyQ21GeVZmckIzSF9tWTVtRFNKQUVLSFFic1NaWWdPWjJidXYzUmxVUUtHVnlhLUhUMTdOSm95ejA3RHVhZUJYYU5Ud2JmRnFua3BhZjRHbmNVbFlwYWN0bXBDdWNxQkltSlVjNGR0N1ROZ3lTMEhockVlalVoTWRLVVo2RjRseEkwY0pWcmtJMmx4NTItLXdRaVBVWS1JbTJDbGswdFRMSHp4NDlpZ0dxc2h3ZlgyMml1Mm53dWpJR3VrdjV2RVRweTJXVmViN3k2dl82XzM2TDBTUllfN25xS3B2VklKNUt5d1pRZXRNRE1LTmctUzdERVZST01NRldiOG1kRy1nZ01Id0wzWVlDaUVkdldLTldxSUlPTjNDZ0s5MDc3YmxWQjNQcWxpWHJLTUhZWjcxMXZyQVdPVjMtMlFLWnN2UTkyUUstN3ZjanhsUllTRmlmSlp1dXFfYXA1M244aG5janFyUlpzdUpOajVVV0duUl82REY2YmFZbUdtV3FacFFOdkxhcXk4RW9paEUxbFpsSUFzenctejF3NUJfSFEteGdNVkRZaUhmc01EVUdmemtSbUpTUU4wY0JxVEx2V0gtb1JtcjlTWFhfWFFQc3FqR1ROQkY5aVJsVTIyRzFrTzZaX2NPOXF4SElBQVRzRXNnUjBRV3hxRXY2QjdjSHBBRk9VNW9wVWpsX3c2V1cySlFTcE1VNks4Smlxd2dnOVFMbUlBeUFoaGVNTmVzLmlmWUVRLVBJMnU1V3RiR3J3bkphblE="
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
