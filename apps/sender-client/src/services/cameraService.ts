import { CameraErrorInfo } from "@remoteassist/shared-types";

/**
 * Camera Service for physical device enumeration, stream acquisition,
 * and actionable error diagnosis.
 */
export class CameraService {
  /**
   * Enumerate physical camera devices connected to the Windows 11 machine.
   */
  static async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      throw new Error("MediaDevices API is not supported in this browser environment.");
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput");
    } catch (err) {
      console.error("Failed to enumerate camera devices:", err);
      return [];
    }
  }

  /**
   * Request physical camera stream with optional device selection.
   */
  static async requestCameraStream(
    deviceId?: string,
    constraints?: MediaStreamConstraints
  ): Promise<{ stream: MediaStream; activeDevice: MediaDeviceInfo | null }> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not supported on this platform.");
    }

    const videoConstraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" };

    const mediaConstraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: constraints?.audio ?? false
    };

    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

    // Identify active physical device
    const videoTrack = stream.getVideoTracks()[0];
    let activeDevice: MediaDeviceInfo | null = null;
    if (videoTrack) {
      const devices = await this.getAvailableCameras();
      activeDevice =
        devices.find(
          (d) => d.label === videoTrack.label || d.deviceId === videoTrack.getSettings().deviceId
        ) || null;
    }

    return { stream, activeDevice };
  }

  /**
   * Parse camera errors into clear, actionable, user-facing troubleshooting advice.
   */
  static parseCameraError(error: unknown): CameraErrorInfo {
    const err = error as { name?: string; message?: string };
    const rawName = err?.name || "UnknownError";

    switch (rawName) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return {
          type: "PERMISSION_DENIED",
          rawName,
          title: "Camera Permission Denied",
          message: "Camera access was declined or blocked by browser permissions.",
          troubleshootingTip:
            "Click the camera/lock icon in your browser URL bar and change Camera to 'Allow', or open Windows 11 Settings > Privacy & security > Camera and toggle 'Let desktop apps access your camera' ON."
        };

      case "NotFoundError":
      case "DevicesNotFoundError":
        return {
          type: "HARDWARE_NOT_FOUND",
          rawName,
          title: "No Physical Camera Detected",
          message: "No video input hardware was found connected to this computer.",
          troubleshootingTip:
            "Ensure your external webcam is securely plugged into a working USB port or that your integrated laptop camera is not disabled by a physical privacy slider or function key (e.g. F8 / F10)."
        };

      case "NotReadableError":
      case "TrackStartError":
        return {
          type: "HARDWARE_IN_USE",
          rawName,
          title: "Camera Already in Use",
          message: "The webcam hardware is currently locked by another application.",
          troubleshootingTip:
            "Close any other apps that may be using your camera (such as Microsoft Teams, Zoom, Skype, OBS, or Windows Camera app) and try again."
        };

      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return {
          type: "OVERCONSTRAINED",
          rawName,
          title: "Resolution Constraints Not Supported",
          message: "The selected camera does not support 1080p 30 FPS video constraints.",
          troubleshootingTip:
            "Switching camera resolution to standard 720p or selecting a different connected webcam in the device selector."
        };

      case "SecurityError":
        return {
          type: "SECURITY_RESTRICTION",
          rawName,
          title: "Insecure Context / HTTPS Required",
          message: "WebRTC camera access requires a secure context (HTTPS or localhost).",
          troubleshootingTip:
            "Access the application via https:// or localhost. Camera access cannot be granted over unencrypted HTTP."
        };

      default:
        return {
          type: "UNKNOWN_ERROR",
          rawName,
          title: "Camera Initialization Error",
          message: err?.message || "An unexpected error occurred while initializing the camera.",
          troubleshootingTip:
            "Disconnect and reconnect your camera, reload the page, or restart your browser."
        };
    }
  }
}
