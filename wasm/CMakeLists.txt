# cmake_minimum_required(VERSION <specify CMake version here>)
project(geofix)
cmake_minimum_required(VERSION 3.16)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 14)

include_directories("../..")
include_directories("../../include")
include_directories("/usr/local/include")
include_directories("/usr/local/include/fftw3")
include_directories("/usr/include/eigen3")

message("COMMIT HASH: " ${COMMIT_HASH})

add_definitions(-DCOMMIT_HASH="${COMMIT_HASH}")

add_executable(wasm-module wasm-module.cpp)

# target_link_libraries(wasm-module "/usr/lib/...")

set_target_properties(wasm-module PROPERTIES LINK_FLAGS "--bind -O3 \
-s WASM=1 \
-s DISABLE_EXCEPTION_CATCHING=0 \
-s ALLOW_MEMORY_GROWTH=1 \
-s EXPORTED_RUNTIME_METHODS=\"['ccall', 'cwrap', 'intArrayFromString', 'allocate', 'ALLOC_NORMAL', 'UTF8ToString', 'writeArrayToMemory', 'stringToUTF8']\" \
-s MODULARIZE=1 \
-s EXPORT_NAME=wasmModule \
-s ASSERTIONS=1 \
-s SINGLE_FILE=1")
add_custom_command(TARGET wasm-module POST_BUILD COMMAND ${CMAKE_COMMAND} -E copy "$<TARGET_FILE:wasm-module>" ${PROJECT_SOURCE_DIR}/../lib/wasm-module.js)
