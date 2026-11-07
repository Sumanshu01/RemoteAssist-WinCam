#pragma once

#include "common.hpp"
#include "logger.hpp"
#include <functional>
#include <memory>
#include <atomic>
#include <string>

namespace remoteassist {

using FrameCallback = std::function<void(const VideoFrame&)>;
using StateCallback = std::function<void(ConnectionState)>;

class ReceiverCore {
public:
    ReceiverCore();
    ~ReceiverCore();

    // Lifecycle & Initialization
    StatusCode initialize(const std::string& sessionId, const SecurityPolicy& policy);
    void shutdown();

    // Authentication & Session Joining
    StatusCode authenticate(const AuthCredentials& credentials);
    StatusCode connect(const std::string& signalingEndpoint, const std::string& sessionCode);
    StatusCode reconnect();
    StatusCode disconnect(const std::string& reason);

    // Stream Controls
    StatusCode startStreaming();
    StatusCode stopStreaming();

    // Consent Management
    StatusCode updateConsent(ConsentState state);
    ConsentState getConsentState() const;

    // Video Decoding & Ingestion
    StatusCode pushIncomingFrame(const VideoFrame& frame);
    StatusCode decodeAndPushFrame(const uint8_t* rawData, size_t size, const VideoFrameDesc& desc);
    void setFrameCallback(FrameCallback callback);

    // State & Diagnostics
    ConnectionState getConnectionState() const;
    void setConnectionStateCallback(StateCallback callback);
    ReceiverMetrics getMetrics() const;
    bool isStreamActive() const;

private:
    void transitionState(ConnectionState newState);

    std::string m_sessionId;
    SecurityPolicy m_policy;
    AuthCredentials m_credentials;
    std::string m_signalingEndpoint;

    std::atomic<ConnectionState> m_connectionState{ConnectionState::Idle};
    std::atomic<ConsentState> m_consentState{ConsentState::None};
    std::atomic<bool> m_isInitialized{false};
    std::atomic<bool> m_isActive{false};
    std::atomic<bool> m_isAuthenticated{false};

    mutable FastLock m_metricsLock;
    ReceiverMetrics m_metrics;
    FrameCallback m_frameCallback;
    StateCallback m_stateCallback;
    uint64_t m_lastFrameTimestamp{0};
};

} // namespace remoteassist
