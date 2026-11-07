# Windows 11 Virtual Camera Architecture & Privacy Model

## Overview

Windows 11 introduced a modernized camera platform architecture centered around the Media Foundation `IMFVirtualCamera` API. Prior to Windows 11, virtual cameras required custom kernel-mode drivers (AVStream) or legacy DirectShow source filters.

## Windows 11 Media Foundation Virtual Camera API

### 1. Registration

Virtual cameras can be registered in user-mode using:

```cpp
HRESULT MFCreateVirtualCamera(
    MFVirtualCameraType type,
    MFVirtualCameraLifetime lifetime,
    MFVirtualCameraAccess access,
    LPCWSTR friendlyName,
    LPCWSTR clsid,
    LPCWSTR categories,
    IMFVirtualCamera** ppVirtualCamera
);
```

- **Type**: `MFVirtualCameraType_SoftwareCameraSource`
- **Lifetime**: `MFVirtualCameraLifetime_Session` (active only while RemoteAssist WinCam is running)
- **Access**: `MFVirtualCameraAccess_CurrentUser`

### 2. Privacy & System Tray Integration

In Windows 11, whenever an application opens an `IMFVirtualCamera` stream:

- The Windows 11 taskbar displays the active camera microphone / video icon.
- Clicking the tray icon reveals the application actively consuming or routing video.
- Windows Settings (`ms-settings:privacy-webcam`) can disable camera access per application.

### 3. Ethical Safeguards & Prohibitions

- **Anti-Spoofing Guarantee**: RemoteAssist WinCam registers explicitly with the prefix `RemoteAssist WinCam — Virtual Stream` and does not impersonate integrated webcams.
- **Biometric Security Boundary**: The virtual camera is tagged under `KSCATEGORY_VIDEO_CAMERA` and is excluded from `KSCATEGORY_SENSOR_CAMERA` used by Windows Hello face authentication.
- **Immediate Revocation**: Calling `IMFVirtualCamera::Stop` or `IMFVirtualCamera::Shutdown` instantly terminates frame pipeline delivery upon sender or specialist revocation.
