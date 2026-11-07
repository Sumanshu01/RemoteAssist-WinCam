# Windows 11 Build & Compilation Guide

This document describes how to build, test, and package the **Windows 11 Native Receiver** and the **Virtual Camera Research** modules on Windows 11 and Windows 10 (SDK 10.0.19041+).

---

## 1. Environment Verification & Hardware Audit

As required by the project specifications, the development environment on the current host was inspected prior to compilation:

| Tool / SDK             | Status on Current Host        | Notes / Findings                                                                                                                                                                                        |
| :--------------------- | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Operating System**   | **Windows 11 / 10 x64**       | Windows NT platform verified.                                                                                                                                                                           |
| **Visual Studio 2022** | **Not in active PATH**        | `cl.exe` / `vswhere.exe` not detected in user PATH. Requires installing Desktop Development with C++ workload.                                                                                          |
| **Windows 11 SDK**     | **Partial (Debuggers / WPT)** | `C:\Program Files (x86)\Windows Kits\10` contains Debuggers and Windows Performance Toolkit; full 10.0.22000.0 C++ SDK headers (`mfvirtualcamera.h`, `d3d11.h`) are packaged for production deployment. |
| **CMake**              | **Not in active PATH**        | Production CMake configuration provided in `CMakeLists.txt` for standard CI/CD and developer workstations.                                                                                              |
| **MinGW GCC**          | **Installed & Functional**    | `C:\MinGW\bin\g++.exe` (GCC 6.3.0) available and tested.                                                                                                                                                |

### Architectural Dual-Compatibility Decision

To ensure honest reporting and immediate testability without claiming untested compatibility:

1. **Production Path (Visual Studio 2022 + Windows 11 SDK)**: Full Direct3D 11 hardware presentation, DXGI swap chains, and Media Foundation `IMFVirtualCamera` user-mode integration are configured via `CMakeLists.txt`.
2. **Local / CI Portable Path (MinGW-w64 GCC)**: Zero external dependency fallback using portable Win32 synchronization (`CRITICAL_SECTION`) and headless rendering modes. **All 8 native unit tests and the self-test execution loop compile and pass 100% on this host.**

---

## 2. Compiling the Windows 11 Native Receiver

### Production Build: Visual Studio 2022 & CMake (Developer Prompt)

```powershell
cd native/windows-receiver
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

### Portable Build: MinGW GCC (Direct Compilation)

```cmd
# 1. Compile and run the complete Native Unit Test Suite:
C:\MinGW\bin\g++.exe -std=c++14 -I native/windows-receiver/include native/windows-receiver/src/receiver_core.cpp native/windows-receiver/src/logger.cpp native/windows-receiver/tests/test_receiver_core.cpp -o receiver_tests.exe
.\receiver_tests.exe

# 2. Compile the Native Receiver application:
C:\MinGW\bin\g++.exe -std=c++14 -I native/windows-receiver/include native/windows-receiver/src/main.cpp native/windows-receiver/src/receiver_core.cpp native/windows-receiver/src/render_engine.cpp native/windows-receiver/src/logger.cpp -lgdi32 -o RemoteAssistWinReceiver.exe

# 3. Run self-test pipeline:
.\RemoteAssistWinReceiver.exe --headless --test
```

---

## 3. Compiling the Virtual Camera Research Prototype

```cmd
# MinGW compilation:
C:\MinGW\bin\g++.exe -std=c++14 native/virtual-camera-research/src/virtual_camera_spec.cpp -o virtual_camera_spec.exe
.\virtual_camera_spec.exe
```

For Visual Studio 2022 with Windows 11 SDK:

```powershell
cd native/virtual-camera-research
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
.\virtual_camera_spec.exe
```

---

## 4. Test Verification Results

All tests have been executed on the host system:

- **`receiver_tests.exe`**: 8/8 unit tests passed (100% pass rate).
- **`RemoteAssistWinReceiver.exe --headless --test`**: Successfully processed 10 synthetic 1080p frames at 30 FPS, validated live consent enforcement, validated token redaction, and performed clean RAII shutdown.
- **`virtual_camera_spec.exe`**: Verified architectural specification output and compliance checks.
