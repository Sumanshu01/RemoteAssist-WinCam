#include "remoteassist/receiver_core.hpp"
#include "remoteassist/logger.hpp"
#include <cassert>
#include <iostream>
#include <string>
#include <chrono>

void test_initialization() {
    remoteassist::ReceiverCore core;
    remoteassist::SecurityPolicy policy;

    assert(core.initialize("", policy) == remoteassist::StatusCode::InvalidParameter);
    assert(core.initialize("VALID_SESSION", policy) == remoteassist::StatusCode::Success);
    assert(core.getConsentState() == remoteassist::ConsentState::None);
    assert(core.getConnectionState() == remoteassist::ConnectionState::Idle);
    std::cout << "[PASS] test_initialization\n";
}

void test_authentication_success_and_failure() {
    remoteassist::ReceiverCore core;
    remoteassist::SecurityPolicy policy;
    core.initialize("VALID_SESSION", policy);

    // 1. Missing credentials
    remoteassist::AuthCredentials emptyCreds;
    assert(core.authenticate(emptyCreds) == remoteassist::StatusCode::AuthenticationFailed);

    // 2. Expired credentials
    remoteassist::AuthCredentials expiredCreds;
    expiredCreds.token = "raw_tok_expired_999";
    expiredCreds.sessionCode = "VALID_SESSION";
    expiredCreds.helperId = "helper_01";
    expiredCreds.expiresAtEpochSeconds = 1000; // Past epoch
    assert(core.authenticate(expiredCreds) == remoteassist::StatusCode::SessionExpired);

    // 3. Valid credentials
    remoteassist::AuthCredentials validCreds;
    validCreds.token = "raw_tok_valid_secret_hash_2026";
    validCreds.sessionCode = "VALID_SESSION";
    validCreds.helperId = "helper_01";
    validCreds.expiresAtEpochSeconds = 0; // Infinite for test
    assert(core.authenticate(validCreds) == remoteassist::StatusCode::Success);

    std::cout << "[PASS] test_authentication_success_and_failure\n";
}

void test_connection_and_reconnection_state_machine() {
    remoteassist::ReceiverCore core;
    remoteassist::SecurityPolicy policy;
    core.initialize("RAW-482-195", policy);

    // Cannot connect before authentication
    assert(core.connect("http://localhost:4000", "RAW-482-195") == remoteassist::StatusCode::AuthenticationFailed);

    // Authenticate
    remoteassist::AuthCredentials creds;
    creds.token = "raw_tok_valid";
    creds.sessionCode = "RAW-482-195";
    creds.helperId = "helper_aris";
    core.authenticate(creds);

    // Connect
    assert(core.connect("http://localhost:4000", "RAW-482-195") == remoteassist::StatusCode::Success);
    assert(core.getConnectionState() == remoteassist::ConnectionState::Connected);

    // Reconnect on network handover
    assert(core.reconnect() == remoteassist::StatusCode::Success);
    assert(core.getConnectionState() == remoteassist::ConnectionState::Connected);

    // Disconnect
    assert(core.disconnect("Test shutdown") == remoteassist::StatusCode::Success);
    assert(core.getConnectionState() == remoteassist::ConnectionState::Disconnected);

    std::cout << "[PASS] test_connection_and_reconnection_state_machine\n";
}

void test_consent_enforcement_blocks_frames() {
    remoteassist::ReceiverCore core;
    remoteassist::SecurityPolicy policy;
    core.initialize("VALID_SESSION", policy);

    remoteassist::VideoFrame frame;
    frame.desc.width = 640;
    frame.desc.height = 480;
    frame.data.resize(640 * 480 * 4, 255);

    // Frame must be rejected when consent is None
    remoteassist::StatusCode status = core.pushIncomingFrame(frame);
    assert(status == remoteassist::StatusCode::ConsentRequired);
    assert(core.getMetrics().framesDropped == 1);
    std::cout << "[PASS] test_consent_enforcement_blocks_frames\n";
}

void test_consent_granted_allows_frames() {
    remoteassist::ReceiverCore core;
    remoteassist::SecurityPolicy policy;
    core.initialize("VALID_SESSION", policy);

    core.updateConsent(remoteassist::ConsentState::Granted);
    assert(core.getConsentState() == remoteassist::ConsentState::Granted);
    assert(core.isStreamActive() == true);
    assert(core.getConnectionState() == remoteassist::ConnectionState::Streaming);

    bool frameReceivedCallbackCalled = false;
    core.setFrameCallback([&frameReceivedCallbackCalled](const remoteassist::VideoFrame& /*f*/) {
        frameReceivedCallbackCalled = true;
    });

    remoteassist::VideoFrame frame;
    frame.desc.width = 640;
    frame.desc.height = 480;
    frame.data.resize(640 * 480 * 4, 100);

    remoteassist::StatusCode status = core.pushIncomingFrame(frame);
    assert(status == remoteassist::StatusCode::Success);
    assert(core.getMetrics().framesReceived == 1);
    assert(frameReceivedCallbackCalled == true);
    std::cout << "[PASS] test_consent_granted_allows_frames\n";
}

void test_consent_revocation_immediately_blocks_stream() {
    remoteassist::ReceiverCore core;
    remoteassist::SecurityPolicy policy;
    core.initialize("VALID_SESSION", policy);

    core.updateConsent(remoteassist::ConsentState::Granted);
    core.updateConsent(remoteassist::ConsentState::Revoked);
    assert(core.isStreamActive() == false);

    remoteassist::VideoFrame frame;
    frame.desc.width = 640;
    frame.desc.height = 480;
    frame.data.resize(640 * 480 * 4, 50);

    remoteassist::StatusCode status = core.pushIncomingFrame(frame);
    assert(status == remoteassist::StatusCode::ConsentRequired);
    std::cout << "[PASS] test_consent_revocation_immediately_blocks_stream\n";
}

void test_structured_log_sensitive_redaction() {
    std::string sensitiveLog = "User authenticated with Bearer eyJhbGciOiJIUzI1NiJ9.secret and password='SuperSecretPassword!' ssn=123-45-6789";
    std::string redacted = remoteassist::Logger::redact(sensitiveLog);

    assert(redacted.find("SuperSecretPassword") == std::string::npos);
    assert(redacted.find("123-45-6789") == std::string::npos);
    assert(redacted.find("[REDACTED_PASSWORD]") != std::string::npos);
    assert(redacted.find("[REDACTED_SSN]") != std::string::npos);

    std::cout << "[PASS] test_structured_log_sensitive_redaction\n";
}

void test_decode_and_push_frame() {
    remoteassist::ReceiverCore core;
    remoteassist::SecurityPolicy policy;
    core.initialize("VALID_SESSION", policy);
    core.updateConsent(remoteassist::ConsentState::Granted);

    remoteassist::VideoFrameDesc desc;
    desc.width = 1920;
    desc.height = 1080;
    desc.stride = 1920 * 4;
    desc.format = remoteassist::PixelFormat::RGBA32;

    std::vector<uint8_t> buffer(1920 * 1080 * 4, 200);
    remoteassist::StatusCode status = core.decodeAndPushFrame(buffer.data(), buffer.size(), desc);
    assert(status == remoteassist::StatusCode::Success);
    assert(core.getMetrics().framesReceived == 1);

    std::cout << "[PASS] test_decode_and_push_frame\n";
}

int main() {
    std::cout << "====================================================\n";
    std::cout << " Running Windows 11 Native Receiver Unit Test Suite\n";
    std::cout << "====================================================\n";
    test_initialization();
    test_authentication_success_and_failure();
    test_connection_and_reconnection_state_machine();
    test_consent_enforcement_blocks_frames();
    test_consent_granted_allows_frames();
    test_consent_revocation_immediately_blocks_stream();
    test_structured_log_sensitive_redaction();
    test_decode_and_push_frame();
    std::cout << "====================================================\n";
    std::cout << " All Native Receiver Unit Tests PASSED (8/8)!\n";
    std::cout << "====================================================\n";
    return 0;
}
