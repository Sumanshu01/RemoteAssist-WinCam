#pragma once

#include "common.hpp"
#include <string>
#include <sstream>
#include <iostream>
#include <chrono>
#include <iomanip>

namespace remoteassist {

enum class LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Security = 4
};

class Logger {
public:
    static Logger& instance();

    void setLogLevel(LogLevel level);
    LogLevel getLogLevel() const;

    void log(LogLevel level, const std::string& component, const std::string& message);

    /**
     * Redact sensitive tokens, passwords, and PII from log output
     */
    static std::string redact(const std::string& input);

private:
    Logger();
    ~Logger() = default;

    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;

    FastLock m_mutex;
    LogLevel m_minLevel{LogLevel::Info};
};

#define LOG_DEBUG(comp, msg) remoteassist::Logger::instance().log(remoteassist::LogLevel::Debug, comp, msg)
#define LOG_INFO(comp, msg)  remoteassist::Logger::instance().log(remoteassist::LogLevel::Info, comp, msg)
#define LOG_WARN(comp, msg)  remoteassist::Logger::instance().log(remoteassist::LogLevel::Warn, comp, msg)
#define LOG_ERROR(comp, msg) remoteassist::Logger::instance().log(remoteassist::LogLevel::Error, comp, msg)
#define LOG_SEC(comp, msg)   remoteassist::Logger::instance().log(remoteassist::LogLevel::Security, comp, msg)

} // namespace remoteassist
