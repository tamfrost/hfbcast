emcc --version
emcc --bind -O3 \
-s WASM=1 \
-s DISABLE_EXCEPTION_CATCHING=0 \
-s ALLOW_MEMORY_GROWTH=1 \
-s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'intArrayFromString', 'allocate', 'ALLOC_NORMAL', 'UTF8ToString', 'stringToUTF8', 'writeArrayToMemory']" \
-s MODULARIZE=1 \
-s EXPORT_NAME="subspaceModule" \
-s ASSERTIONS=1 \
-s SINGLE_FILE=1 \
-o wasm-module.js \
wasm-module.cpp
