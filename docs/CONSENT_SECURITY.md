# RemoteAssist WinCam — Consent & Security Model

## 1. Ethical Guardrails

RemoteAssist WinCam is designed with **zero-trust security principles** and clear ethical boundaries. Remote support tools are frequently targeted by bad actors for social engineering, unauthorized surveillance, or stealth takeover. The architecture of RemoteAssist WinCam actively prevents these threat vectors:

### 1.1 Prohibitions & Hard Boundaries

1. **No Remote Input Injection (No Remote Control)**:
   - There are no APIs, drivers, or modules for simulating `SendInput`, synthetic keystrokes, mouse clicks, or touch gestures.
   - Remote specialists may only provide visual guidance through non-intrusive on-screen pointers and annotations.
2. **No Camera Spoofing**:
   - The system does not forge USB hardware IDs, spoof DirectShow names, or impersonate system biometrics (Windows Hello).
3. **No Hidden Camera Access**:
   - The physical camera sensor LED remains illuminated.
   - On Windows 11, the taskbar camera tray indicator is automatically triggered.
4. **No Identity Verification Bypasses**:
   - All session joins require affirmative user participation and PIN validation.

---

## 2. Two-Party Consent State Machine

```
              [ INITIALIZING ]
                     |
                     v
             [ AWAITING_CONSENT ]
               /            \
   (Sender Grants)        (Specialist Grants)
             /                \
   [ SENDER_CONSENTED ]    [ SPECIALIST_CONSENTED ]
             \                /
              \              /
           (Mutual Agreement Satisfied)
                     |
                     v
                 [ ACTIVE ]
             (Media Stream Live)
               /            \
    (Emergency Revoke)    (Session Timeout)
             /                \
            v                  v
     [ REVOKED ]          [ EXPIRED ]
```

### 2.1 Revocation Mechanics

- Revocation is unilateral: either participant can revoke consent at any moment.
- The signaling server immediately broadcasts a `consent-revoked` event.
- The Windows 11 Native Receiver and WebRTC peer connection immediately close all data and video channels, purge frame buffers, and restore the UI to standby mode.
