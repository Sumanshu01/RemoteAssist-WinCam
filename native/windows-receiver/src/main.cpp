#include "remoteassist/common.hpp"
#include "remoteassist/receiver_core.hpp"
#include "remoteassist/render_engine.hpp"
#include "remoteassist/logger.hpp"
#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <vector>

#ifdef _WIN32
#include <windows.h>

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_KEYDOWN:
            if (wParam == VK_ESCAPE) {
                PostQuitMessage(0);
                return 0;
            }
            break;
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
        default:
            return DefWindowProc(hwnd, msg, wParam, lParam);
    }
    return 0;
}
#endif

int main(int argc, char* argv[]) {
    std::cout << "=========================================================\n";
    std::cout << " RemoteAssist WinCam - Windows 11 Native Receiver v1.0.0\n";
    std::cout << " Consent-Governed Cross-Border Video Stream Architecture\n";
    std::cout << " Corridor: India (IN) -> Canada (CA)\n";
    std::cout << "=========================================================\n";

    std::string sessionId = "RAW-482-195";
    std::string authToken = "raw_tok_specialist_can_992182";
    std::string signalingUrl = "http://localhost:4000";
    bool headless = false;
    bool testMode = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--headless") headless = true;
        else if (arg == "--test") testMode = true;
        else if (arg.rfind("--session=", 0) == 0) {
            sessionId = arg.substr(10);
        } else if (arg.rfind("--token=", 0) == 0) {
            authToken = arg.substr(8);
        } else if (arg.rfind("--signaling=", 0) == 0) {
            signalingUrl = arg.substr(12);
        }
    }

    LOG_INFO("Main", "Initializing Native Windows 11 Receiver for session " + sessionId);
    LOG_INFO("Main", "Signaling endpoint: " + signalingUrl);

    remoteassist::SecurityPolicy policy;
    policy.requireTwoPartyConsent = true;
    policy.allowRemoteControl = false; // Strictly enforced: visual pointer only
    policy.enableTrayIndicator = true;
    policy.enableHardwareLedIndicator = true;

    remoteassist::ReceiverCore receiver;
    remoteassist::StatusCode status = receiver.initialize(sessionId, policy);
    if (status != remoteassist::StatusCode::Success) {
        LOG_ERROR("Main", "Failed to initialize ReceiverCore pipeline.");
        return 1;
    }

    // Authenticate with credentials (token is auto-redacted in logs)
    remoteassist::AuthCredentials creds;
    creds.token = authToken;
    creds.sessionCode = sessionId;
    creds.helperId = "usr_helper_aris_vance";
    creds.expiresAtEpochSeconds = 0; // Infinite for demo session

    status = receiver.authenticate(creds);
    if (status != remoteassist::StatusCode::Success) {
        LOG_ERROR("Main", "Authentication failed. Exiting.");
        return 1;
    }

    // Connect to session room
    status = receiver.connect(signalingUrl, sessionId);
    if (status != remoteassist::StatusCode::Success) {
        LOG_ERROR("Main", "Signaling connection failed.");
        return 1;
    }

    remoteassist::RenderEngine renderer;

#ifdef _WIN32
    HWND hwnd = nullptr;
    if (!headless) {
        WNDCLASS wc = {};
        wc.lpfnWndProc = WndProc;
        wc.hInstance = GetModuleHandle(nullptr);
        wc.lpszClassName = "RemoteAssistWinCamClass";
        wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
        RegisterClass(&wc);

        hwnd = CreateWindowEx(
            0,
            "RemoteAssistWinCamClass",
            "RemoteAssist WinCam — Windows 11 Native Receiver (Consent-Governed)",
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT, CW_USEDEFAULT, 1280, 720,
            nullptr, nullptr, GetModuleHandle(nullptr), nullptr
        );

        if (hwnd) {
            ShowWindow(hwnd, SW_SHOW);
            UpdateWindow(hwnd);
            renderer.initialize(hwnd, 1280, 720);
            LOG_INFO("Main", "Direct3D 11 Viewport created successfully (1280x720).");
        }
    }
#endif

    // Setup frame rendering callback
    receiver.setFrameCallback([&renderer](const remoteassist::VideoFrame& frame) {
        renderer.renderFrame(frame);
    });

    if (testMode) {
        LOG_INFO("Main", "Running self-test sequence with synthetic 1080p frames...");

        // Grant consent
        receiver.updateConsent(remoteassist::ConsentState::Granted);

        // Generate synthetic test frame (1920x1080 30FPS RGBA)
        remoteassist::VideoFrame testFrame;
        testFrame.desc.width = 1920;
        testFrame.desc.height = 1080;
        testFrame.desc.stride = 1920 * 4;
        testFrame.desc.format = remoteassist::PixelFormat::RGBA32;
        testFrame.data.resize(1920 * 1080 * 4, 128); // Neutral test pattern

        for (int f = 0; f < 10; ++f) {
            receiver.pushIncomingFrame(testFrame);
#ifdef _WIN32
            Sleep(33); // ~30 FPS on Windows
#else
            std::this_thread::sleep_for(std::chrono::milliseconds(33)); // ~30 FPS
#endif
        }

        auto metrics = receiver.getMetrics();
        LOG_INFO("Main", "Test frames processed: " + std::to_string(metrics.framesReceived) +
                 ", Dropped: " + std::to_string(metrics.framesDropped));

        // Test revocation
        receiver.updateConsent(remoteassist::ConsentState::Revoked);
        receiver.pushIncomingFrame(testFrame); // Should be dropped
        LOG_INFO("Main", "Post-revocation frame dropped verification: " +
                 std::to_string(receiver.getMetrics().framesDropped) + " dropped.");
    }

    LOG_INFO("Main", "Cleaning up native receiver resources and shutting down.");
    renderer.shutdown();
    receiver.shutdown();

    std::cout << "RemoteAssist WinCam Native Receiver completed successfully.\n";
    return 0;
}
