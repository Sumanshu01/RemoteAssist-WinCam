cmake_minimum_required(VERSION 3.20)
project(RemoteAssistVirtualCameraResearch VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if (MSVC)
    add_compile_options(/W4 /EHsc)
    add_definitions(-DUNICODE -D_UNICODE)
endif()

add_executable(virtual_cam_spec src/virtual_camera_spec.cpp)

if (WIN32)
    target_link_libraries(virtual_cam_spec PRIVATE
        mfplat
        mf
        mfreadwrite
        mfuuid
        user32
    )
endif()
