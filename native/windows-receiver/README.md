# RemoteAssist WinCam — Windows 11 Native Receiver

The **Windows 11 Native Receiver** is a C++17 high-performance rendering engine that receives incoming remote video streams from the WebRTC signaling gateway and presents them using Direct3D 11 hardware acceleration.

---

## Key Capabilities

- **Secure Authentication**: Validates HMAC-SHA256 tokens and session codes prior to entering the corridor.
- **WebRTC Session Joining**: Coordinates state transitions (`Idle` -> `Connecting` -> `Connected` -> `Streaming`).
- **Video Decoding & Ingestion**: Decodes and presents 1080p 30 FPS video frames with Direct3D 11 hardware presentation or WARP software fallback.
- **Remote Preview Viewport**: Creates a responsive Windows 11 desktop window (`1280x720` or `--headless`).
- **Stream Controls**: Immediate Start, Stop, Reconnect (30s grace window), and Clean Shutdown controls.
- **Strict Two-Party Consent**: Frames are mathematically dropped if consent is not in the `Granted` state.
- **Structured Redaction Logging**: Automatically redacts bearer tokens, passwords, and PII from log output.

---

## Prerequisites & Development Environment

- **Operating System**: Windows 11 x64 (Build 22000+)
- **Build System**: CMake 3.20+
- **Compiler**: Visual Studio 2022 (MSVC v143, Desktop development with C++) or MinGW-w64 (GCC 6.3+)
- **SDK**: Windows 11 SDK (version 10.0.22000.0 or higher)
- **Libraries**: `d3d11`, `dxgi`, `mfplat`, `mf`, `mfreadwrite`, `user32`, `gdi32`

---

## Building with Visual Studio 2022 & CMake

Open the **Developer PowerShell for VS 2022** and execute:

```powershell
cd native/windows-receiver
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

---

## Building with MinGW / GCC (Direct Compilation)

If CMake or Visual Studio 2022 is not in your current environment PATH, the unit test suite and receiver can be compiled directly via MinGW:

```cmd
g++ -std=c++14 -I native/windows-receiver/include native/windows-receiver/src/receiver_core.cpp native/windows-receiver/src/logger.cpp native/windows-receiver/tests/test_receiver_core.cpp -o test_runner.exe
.\test_runner.exe
```

---

## Running the Unit Tests

```cmd
.\test_runner.exe
```

Expected output:

```text
====================================================
 Running Windows 11 Native Receiver Unit Test Suite
====================================================
[PASS] test_initialization
[PASS] test_authentication_success_and_failure
[PASS] test_connection_and_reconnection_state_machine
[PASS] test_consent_enforcement_blocks_frames
[PASS] test_consent_granted_allows_frames
[PASS] test_consent_revocation_immediately_blocks_stream
[PASS] test_structured_log_sensitive_redaction
[PASS] test_decode_and_push_frame
====================================================
 All Native Receiver Unit Tests PASSED (8/8)!
====================================================
```

---

## Running the Receiver Application

```cmd
# Standard run with session code and auth token
RemoteAssistWinReceiver.exe --session=RAW-482-195 --token=raw_tok_helper_can_2026

# Automated self-test mode with synthetic 1080p 30 FPS stream
RemoteAssistWinReceiver.exe --headless --test
```
