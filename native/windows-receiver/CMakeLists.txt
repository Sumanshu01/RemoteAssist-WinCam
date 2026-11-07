cmake_minimum_required(VERSION 3.20)
project(RemoteAssistWinReceiver VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler warnings & definitions
if (MSVC)
    add_compile_options(/W4 /permissive- /EHsc)
    add_definitions(-DUNICODE -D_UNICODE -DWIN32_LEAN_AND_MEAN)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

include_directories(include)

# Source and Header files
set(RECEIVER_SOURCES
    src/main.cpp
    src/receiver_core.cpp
    src/render_engine.cpp
    src/logger.cpp
)

set(RECEIVER_HEADERS
    include/remoteassist/common.hpp
    include/remoteassist/receiver_core.hpp
    include/remoteassist/render_engine.hpp
    include/remoteassist/logger.hpp
)

add_executable(RemoteAssistWinReceiver ${RECEIVER_SOURCES} ${RECEIVER_HEADERS})

# Link Windows libraries (Media Foundation, Direct3D 11, DXGI, User32, GDI32)
if (WIN32)
    target_link_libraries(RemoteAssistWinReceiver PRIVATE
        d3d11
        dxgi
        mfplat
        mf
        mfreadwrite
        mfuuid
        user32
        gdi32
    )
endif()

# Unit tests target
enable_testing()
add_executable(receiver_tests
    tests/test_receiver_core.cpp
    src/receiver_core.cpp
    src/logger.cpp
)

target_include_directories(receiver_tests PRIVATE include)
if (WIN32)
    target_link_libraries(receiver_tests PRIVATE user32)
endif()

add_test(NAME CoreReceiverTests COMMAND receiver_tests)
