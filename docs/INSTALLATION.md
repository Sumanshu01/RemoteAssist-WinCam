# RemoteAssist WinCam — Installation & Uninstallation Guide

This document provides step-by-step instructions for installing, configuring, running, and cleanly uninstalling all components of **RemoteAssist WinCam** on Windows 11 and cross-platform server environments.

---

## 1. System Requirements & Prerequisites

### Server & Web Components

- **Node.js**: Version 20.x or 22.x LTS (Node.js 22.12.0+ tested)
- **Package Manager**: npm 10.x+
- **Database**: PostgreSQL 14+ (optional for local in-memory mock mode; required for persistent production deployment)
- **Web Browsers**: Chromium-based browser (Google Chrome 115+, Microsoft Edge 115+) or Mozilla Firefox 115+ with WebRTC and camera permissions enabled

### Windows 11 Native Receiver Component

- **Operating System**: Windows 11 x64 (Build 22000 or later) / Windows 10 x64
- **Hardware**: Direct3D 11 capable GPU or DirectX WARP software rasterizer
- **Toolsets (for building from source)**:
  - Production: Visual Studio 2022 (MSVC v143) with Desktop development with C++ workload and Windows 11 SDK (10.0.22000.0+)
  - Portable/CI: MinGW-w64 (GCC 6.3+) with Win32 thread support

---

## 2. Repository Setup & Dependency Installation

```powershell
# 1. Clone repository
git clone https://github.com/remoteassist/remoteassist-wincam.git
cd remoteassist-wincam

# 2. Install monorepo dependencies across all workspaces
npm install

# 3. Configure environment variables from template
Copy-Item .env.example .env
```

Review and adjust the `.env` configuration as needed:

```ini
SIGNALING_PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/remoteassist_wincam?schema=public
STUN_SERVER_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

---

## 3. Database Migration Setup (PostgreSQL)

If using a live PostgreSQL database:

```powershell
# Apply initial schema migration via raw SQL script:
psql -h localhost -U postgres -d remoteassist_wincam -f services/signaling-server/prisma/migrations/20261020000000_init/migration.sql

# Or using Prisma CLI:
npm run prisma:migrate --workspace=@remoteassist/signaling-server
```

_Note: For evaluation and offline development, the signaling server includes an in-memory fallback store (`DbStore`) that operates seamlessly without a live PostgreSQL instance._

---

## 4. Building the Applications

### Building Web Apps & Signaling Gateway

```powershell
# Build shared types, signaling server, sender client, and web dashboard:
npm run build
```

Build artifacts are placed in:

- `services/signaling-server/dist/`
- `apps/sender-client/dist/`
- `apps/web-dashboard/dist/`

### Building the Windows 11 Native Receiver

```powershell
# Direct compilation using MinGW:
C:\MinGW\bin\g++.exe -std=c++14 -I native/windows-receiver/include native/windows-receiver/src/main.cpp native/windows-receiver/src/receiver_core.cpp native/windows-receiver/src/render_engine.cpp native/windows-receiver/src/logger.cpp -lgdi32 -o RemoteAssistWinReceiver.exe

# Or using Visual Studio 2022 with CMake:
cd native/windows-receiver
mkdir build; cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

---

## 5. Running the Complete System Locally

### Step 1: Start the Signaling Server

```powershell
npm run dev:server
# Server listens on http://localhost:4000 (Health check: http://localhost:4000/health)
```

### Step 2: Start the Web Dashboard (Receiver Specialist - Canada)

```powershell
npm run dev:dashboard
# Web Dashboard opens on http://localhost:5173
```

### Step 3: Start the Sender Client (Applicant - India)

```powershell
npm run dev:sender
# Sender client opens on http://localhost:5174
```

### Step 4: Run the Windows 11 Native Receiver (Optional Native Client)

```powershell
# Interactive GUI mode:
.\RemoteAssistWinReceiver.exe --session=RAW-482-195 --token=raw_tok_helper_can_2026

# Automated self-test mode (headless pipeline validation):
.\RemoteAssistWinReceiver.exe --headless --test
```

---

## 6. Verification Checklist

1. Open `http://localhost:5173` in your browser. Verify the green **Signaling: ONLINE** badge.
2. Generate an invitation code on the dashboard (e.g. `RAW-482-195`).
3. Open `http://localhost:5174?sessionCode=RAW-482-195` in a separate browser window.
4. Allow camera permissions and click **"Grant Consent & Start Live Assist"**.
5. Observe live 1080p 30 FPS video playback on the dashboard with sub-250ms cross-border telemetry.
6. Verify Application Workflow Editor state saves immediately with optimistic concurrency versioning.

---

## 7. Clean Uninstallation & Resource Teardown

To completely uninstall and remove all system modifications and generated files:

### 1. Stop Active Services

```powershell
# Terminate Node.js and receiver background tasks
Get-Process node, RemoteAssistWinReceiver -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 2. Remove Build Outputs and Dependencies

```powershell
# Remove Node dependencies and dist bundles
Remove-Item -Recurse -Force node_modules, apps/*/dist, apps/*/node_modules, services/*/dist, services/*/node_modules, native/windows-receiver/build, RemoteAssistWinReceiver.exe -ErrorAction SilentlyContinue
```

### 3. Database Cleanup

```sql
-- Drop database if created:
DROP DATABASE IF EXISTS remoteassist_wincam;
```

### 4. Windows 11 Camera Device Cleanup

The `IMFVirtualCamera` architecture implements session-lifetime registration (`MFVirtualCameraLifetime_Session`), meaning Windows automatically purges device registrations when the process terminates. If permanent registry keys were created:

```powershell
# Verify no orphaned virtual devices remain under Windows media registry:
Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceClasses\{e5323777-f976-4f5b-9b55-b94699c46e44}\*" -ErrorAction SilentlyContinue
```
