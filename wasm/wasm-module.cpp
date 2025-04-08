#include <iostream>
#include <vector>
#include <emscripten.h>
#include <emscripten/bind.h>

using namespace emscripten;

class MyClass {
    public:
        ~MyClass() {}

        MyClass(uint32_t config) {
            char *configString = reinterpret_cast<char *>(config);
        }

        void method1(int nData, uint32_t dataPtr) {

            double doubleArray[4] = {1,2,3,4};
            double doubleValue = 5;

            EM_ASM({
            methodResolver({
                doubleArray: [...HEAPF64.slice($0>>3, ($0>>3) + $1)],
                doubleValue: $2
            });
            }, &doubleArray[0], 4, doubleValue);
        }

        uintptr_t imageMethod(uint32_t imageDataPointer, int length, double hue) {

            uint8_t* imageData = reinterpret_cast<uint8_t*>(imageDataPointer);
            for (int i = 0; i < length; i+=4) {
                imageData[i]   = imageData[i];
                imageData[i+1] = imageData[i+1];
                imageData[i+2] = imageData[i+2];
            }
            return (uintptr_t) imageData;
        }

        static void logBuildTime() {
            std::cout << "BUILD TIME: " + std::string(__DATE__) + " " + std::string(__TIME__) << std::endl;
        }

        static void logCommitHash() {
            std::cout << "COMMIT HASH: " + std::string(COMMIT_HASH) << std::endl;
        }

        static int getCommitHash() {
            // const char* retArray = (std::string(COMMIT_HASH)).data();
            return (uintptr_t) (std::string(COMMIT_HASH)).data();
        }
};

EMSCRIPTEN_BINDINGS(RfdfSubspace) {
    // register_vector<double>("vector<double>");
    // register_map<std::string, double>("map<string, double>");
    class_<MyClass>("MyClass")
            .constructor<int>()
            .function("method1", &MyClass::method1)
            .function("imageMethod", &MyClass::imageMethod)
            .class_function("logBuildTime", &MyClass::logBuildTime)
            .class_function("logCommitHash", &MyClass::logCommitHash)
            .class_function("getCommitHash", &MyClass::getCommitHash)
            ;
};

// EMSCRIPTEN_KEEPALIVE
// uint8_t* create_buffer(int width, int height) {
//   return malloc(width * height * 4 * sizeof(uint8_t));
// }

// EMSCRIPTEN_KEEPALIVE
// void destroy_buffer(uint8_t* p) {
//   free(p);
// }