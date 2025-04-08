const { execSync } = require('child_process');

if (!process.env.CI_SERVER_HOST) process.env.CI_SERVER_HOST = process.env.DSPDF_CI_SERVER_HOST;
if (!process.env.CI_PROJECT_ID) process.env.CI_PROJECT_ID = process.env['DSPDF_CI_PROJECT_ID_' + process.argv[2].toUpperCase()];

console.log(process.env.CI_SERVER_HOST, process.env.CI_PROJECT_ID);

execSync(`npm config set @dspdf:registry https://${process.env.CI_SERVER_HOST}/api/v4/projects/${process.env.CI_PROJECT_ID}/packages/npm/`);

try {
    const output = execSync(`npm publish`);
    console.log(`stdout: ${output.toString()}`);
} catch (error) {
    console.error(`Error: ${error.message}`);
}

execSync(`npm config set @dspdf:registry https://${process.env.CI_SERVER_HOST}/api/v4/packages/npm/`);
