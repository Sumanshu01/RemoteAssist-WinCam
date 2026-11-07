#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <chrono>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#else
#include <mutex>
#endif

namespace remoteassist {

enum class StatusCode : int32_t {
    Success = 0,
    InvalidParameter = -1,
    ConsentRequired = -2,
    ConsentRevoked = -3,
    DeviceNotFound = -4,
    StreamDisconnected = -5,
    BufferOverflow = -6,
    SecurityViolation = -7,
    AuthenticationFailed = -8,
    ConnectionFailed = -9,
    SessionExpired = -10,
    NetworkError = -11
};

enum class ConnectionState : uint32_t {
    Idle = 0,
    Authenticating = 1,
    Connecting = 2,
    Connected = 3,
    Streaming = 4,
    Reconnecting = 5,
    Disconnected = 6,
    Terminated = 7,
    Failed = 8
};

struct AuthCredentials {
    std::string token;
    std::string sessionCode;
    std::string helperId;
    std::string applicantEmail;
    uint64_t expiresAtEpochSeconds{0};
};

enum class PixelFormat : uint32_t {
    Unknown = 0,
    NV12,
    YUY2,
    RGBA32,
    BGRA32
};

enum class ConsentState : uint32_t {
    None = 0,
    Requested = 1,
    Granted = 2,
    Denied = 3,
    Revoked = 4
};

struct SecurityPolicy {
    bool requireTwoPartyConsent{true};
    bool allowRemoteControl{false};        // Prohibited by architecture
    bool enableTrayIndicator{true};        // Required for Windows 11 compliance
    bool enableHardwareLedIndicator{true}; // Always transparent to user
};

struct VideoFrameDesc {
    uint32_t width{1920};
    uint32_t height{1080};
    uint32_t stride{1920 * 4};
    PixelFormat format{PixelFormat::RGBA32};
    uint64_t timestampNs{0};
    uint64_t sequenceNumber{0};
};

struct VideoFrame {
    VideoFrameDesc desc;
    std::vector<uint8_t> data;
};

struct ReceiverMetrics {
    uint32_t framesReceived{0};
    uint32_t framesDropped{0};
    double currentFps{0.0};
    uint32_t latencyMs{0};
    bool isConsented{false};
};

#ifdef _WIN32
class FastLock {
public:
    FastLock() { InitializeCriticalSection(&m_cs); }
    ~FastLock() { DeleteCriticalSection(&m_cs); }
    void lock() { EnterCriticalSection(&m_cs); }
    void unlock() { LeaveCriticalSection(&m_cs); }
private:
    CRITICAL_SECTION m_cs;
};

class FastLockGuard {
public:
    explicit FastLockGuard(FastLock& lock) : m_lock(lock) { m_lock.lock(); }
    ~FastLockGuard() { m_lock.unlock(); }
private:
    FastLock& m_lock;
};
#else
using FastLock = std::mutex;
using FastLockGuard = std::lock_guard<std::mutex>;
#endif

} // namespace remoteassist
