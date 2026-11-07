# RemoteAssist WinCam — System-Wide Troubleshooting Guide

This guide provides actionable diagnosis and resolution steps for common issues encountered across the Web Dashboard, Sender Client, Signaling Server, WebRTC Traversal, Database, and Windows 11 Native Receiver.

---

## 1. Web Dashboard & Sender Client

### Issue: "Camera Permission Denied (NotAllowedError)"

- **Symptoms**: Sender client shows a red warning banner: _"Camera access was blocked by your browser."_
- **Root Cause**: The user previously clicked "Block" or the browser site permissions prevent camera access on `http://localhost:5174` or non-HTTPS domains.
- **Resolution**:
  1. In Chrome / Edge: Click the **tune / padlock icon** in the browser address bar.
  2. Locate **Camera** and change permission from _Block_ to _Allow_.
  3. Reload the page.
  4. In Windows 11 Settings: Navigate to `Settings > Privacy & security > Camera`. Verify that **"Let desktop apps access your camera"** and **"Let apps access your camera"** are both toggled **ON**.

### Issue: "Camera Already in Use (NotReadableError)"

- **Symptoms**: Sender client reports: _"Webcam is currently utilized by another application."_
- **Root Cause**: Another application (Zoom, Teams, Skype, or another browser tab) has acquired an exclusive lock on the physical video device.
- **Resolution**:
  1. Close any running video conferencing software.
  2. Inspect running processes via Windows Task Manager and close competing camera instances.
  3. In the sender client, switch to an alternative camera using the **Camera Selection dropdown**.

---

## 2. WebRTC Cross-Border Connectivity & Signaling

### Issue: Signaling Status displays "DISCONNECTED" / Offline

- **Symptoms**: Header badge remains gray or red; session codes cannot be joined.
- **Root Cause**: The signaling server process is not running or port 4000 is blocked by a firewall.
- **Resolution**:
  1. Verify the server process:
     ```powershell
     curl http://localhost:4000/health
     ```
  2. If unreachable, start the signaling gateway:
     ```powershell
     npm run dev:server
     ```
  3. Verify port 4000 availability:
     ```powershell
     Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
     ```

### Issue: Peer Connection hangs in `connecting` or transitions to `failed`

- **Symptoms**: Video stream does not render; CrossBorderMetrics shows packet loss approaching 100%.
- **Root Cause**: Both peers are located behind restrictive symmetric NATs or enterprise firewalls that block direct UDP communication via STUN.
- **Resolution**:
  1. Configure TURN relay server in `.env`:
     ```ini
     TURN_SERVER_URL=turn:turn.remoteassist-wincam.org:3478
     TURN_USERNAME=user
     TURN_CREDENTIAL=credential_secret
     ```
  2. Trigger **"Restart ICE Negotiation"** on the Web Dashboard diagnostic panel.
  3. Confirm that outbound UDP port `3478` and UDP relay ports (`49152–65535`) are permitted on your router or enterprise network.

---

## 3. Application Workflow & Concurrency

### Issue: "Concurrency Collision: Server is at version X"

- **Symptoms**: The workflow editor shows an amber warning indicating another user modified the candidate profile.
- **Root Cause**: Two helpers or the candidate modified the checklist simultaneously, triggering an optimistic concurrency version mismatch.
- **Resolution**:
  1. Click **"Retry & Reconcile"** in the workflow editor.
  2. The client fetches the latest server snapshot, preserves local draft notes, and synchronizes with the newest incremented version number.

---

## 4. PostgreSQL Database & Migrations

### Issue: `Can't reach database server at localhost:5432`

- **Symptoms**: Signaling server throws a database connection timeout error on startup.
- **Resolution**:
  1. For local evaluation, the signaling server automatically falls back to the in-memory mock store (`DbStore`), allowing testing without PostgreSQL.
  2. To start PostgreSQL using Docker:
     ```powershell
     docker run -d --name remoteassist-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=remoteassist_wincam -p 5432:5432 postgres:15-alpine
     ```
  3. Apply schema migration:
     ```powershell
     npm run prisma:migrate --workspace=@remoteassist/signaling-server
     ```

---

## 5. Windows 11 Native Receiver Diagnostics

### Issue: `cl.exe` or `cmake` not found in PATH

- **Symptoms**: Visual Studio build fails with command not found errors.
- **Resolution**:
  - Open **Developer PowerShell for VS 2022** from your Windows Start menu.
  - Or use the pre-tested portable MinGW compilation command:
    ```cmd
    C:\MinGW\bin\g++.exe -std=c++14 -I native/windows-receiver/include native/windows-receiver/src/main.cpp native/windows-receiver/src/receiver_core.cpp native/windows-receiver/src/render_engine.cpp native/windows-receiver/src/logger.cpp -lgdi32 -o RemoteAssistWinReceiver.exe
    ```

### Issue: `D3D11CreateDeviceAndSwapChain` returns `DXGI_ERROR_UNSUPPORTED`

- **Symptoms**: Viewport fails to initialize on virtual machines (VMs) or Remote Desktop (RDP).
- **Resolution**:
  - The native receiver automatically activates the **WARP** (Windows Advanced Rasterization Platform) software driver when hardware Direct3D 11 is unavailable.
  - For headless CI/CD runs, pass `--headless`:
    ```cmd
    RemoteAssistWinReceiver.exe --headless --test
    ```

### Issue: `StatusCode::ConsentRequired` (-2)

- **Symptoms**: Video frames arrive at the receiver but are not rendered.
- **Resolution**:
  - This is an **architectural security safeguard**. The applicant must explicitly grant consent in the web client before the native receiver decodes frames.
  - For automated validation, pass `--test` to trigger the synthetic consent grant sequence.
