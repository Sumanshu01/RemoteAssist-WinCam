# Windows 11 Virtual Camera Research & Integration

This module details the systems architecture, security implications, and driver models for streaming video directly into Windows 11 applications as a virtual video source.

## Research Findings Summary

| Model                   | Technology         | OS Requirements           | Privileges                    | Windows 11 Taskbar Indicator | Verdict                  |
| ----------------------- | ------------------ | ------------------------- | ----------------------------- | ---------------------------- | ------------------------ |
| **IMFVirtualCamera**    | Media Foundation   | Windows 11 (Build 22000+) | Standard User / App Container | Yes (Built-in)               | **Recommended Standard** |
| **DirectShow Filter**   | COM InprocServer32 | Windows 7 - 11            | Admin (COM Reg)               | No (Bypassed)                | Legacy only              |
| **AVStream Minidriver** | Kernel WDM / KMDF  | Windows 10 - 11           | Kernel / Admin                | Yes                          | High maintenance         |

## Ethical Constraints & Architectural Safeguards

1. **No Camera Spoofing**: The system does NOT forge hardware identifiers, spoof biometric cameras (Windows Hello), or impersonate trusted hardware.
2. **Transparent Notification**: Whenever a virtual or physical camera stream is active, the Windows 11 system tray camera icon is invoked.
3. **Hardware Sensor Truth**: Physical camera sensors on the sender's device will illuminate the physical LED indicator to assure the user of ongoing capture.
4. **Consent Pre-condition**: No frames are routed to the virtual camera device unless mutual cryptographic consent has been verified by the signaling authority.
