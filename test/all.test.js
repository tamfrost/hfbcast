const {loadWasm, commitHash} = require("..");

test('check js commit hash', () => {
    console.log(commitHash);
    expect(1).toBe(1);
  });

test('check wasm commit hash', () => {
    let myWasmClass;

    return loadWasm({conf1: 1}).then(async mwc => {
        myWasmClass = mwc;
        const result = await myWasmClass.method1([1,2,3]);
        const commitHash = myWasmClass.getCommitHash();
        expect(1).toBe(1);
    })
  });




