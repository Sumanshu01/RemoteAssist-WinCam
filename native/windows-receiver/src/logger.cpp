#include "remoteassist/logger.hpp"
#include <ctime>

namespace remoteassist {

Logger& Logger::instance() {
    static Logger s_instance;
    return s_instance;
}

Logger::Logger() = default;

void Logger::setLogLevel(LogLevel level) {
    FastLockGuard lock(m_mutex);
    m_minLevel = level;
}

LogLevel Logger::getLogLevel() const {
    return m_minLevel;
}

static std::string scrubPattern(const std::string& source, const std::string& prefix, const std::string& replacement) {
    std::string result = source;
    size_t pos = 0;
    while ((pos = result.find(prefix, pos)) != std::string::npos) {
        size_t valStart = pos + prefix.length();
        // Skip whitespace or quotes
        while (valStart < result.length() && (result[valStart] == ' ' || result[valStart] == '=' || result[valStart] == ':' || result[valStart] == '\'' || result[valStart] == '"')) {
            valStart++;
        }
        size_t valEnd = valStart;
        while (valEnd < result.length() && result[valEnd] != ' ' && result[valEnd] != ',' && result[valEnd] != '}' && result[valEnd] != '"' && result[valEnd] != '\'') {
            valEnd++;
        }
        if (valEnd > valStart) {
            result.replace(valStart, valEnd - valStart, replacement);
            pos = valStart + replacement.length();
        } else {
            pos += prefix.length();
        }
    }
    return result;
}

std::string Logger::redact(const std::string& input) {
    std::string result = input;

    // Redact Bearer tokens
    result = scrubPattern(result, "Bearer ", "[REDACTED_TOKEN]");

    // Redact raw_tok_* tokens
    size_t tokPos = 0;
    while ((tokPos = result.find("raw_tok_", tokPos)) != std::string::npos) {
        size_t endPos = tokPos + 8;
        while (endPos < result.length() && (isalnum(static_cast<unsigned char>(result[endPos])) || result[endPos] == '_')) {
            endPos++;
        }
        result.replace(tokPos, endPos - tokPos, "[REDACTED_TOKEN]");
        tokPos += 16;
    }

    // Redact passwords & secrets
    result = scrubPattern(result, "password", "[REDACTED_PASSWORD]");
    result = scrubPattern(result, "secret", "[REDACTED_PASSWORD]");

    // Redact SSN pattern (3 digits - 2 digits - 4 digits)
    for (size_t i = 0; i + 10 < result.length(); ++i) {
        if (isdigit(static_cast<unsigned char>(result[i])) &&
            isdigit(static_cast<unsigned char>(result[i+1])) &&
            isdigit(static_cast<unsigned char>(result[i+2])) &&
            result[i+3] == '-' &&
            isdigit(static_cast<unsigned char>(result[i+4])) &&
            isdigit(static_cast<unsigned char>(result[i+5])) &&
            result[i+6] == '-' &&
            isdigit(static_cast<unsigned char>(result[i+7])) &&
            isdigit(static_cast<unsigned char>(result[i+8])) &&
            isdigit(static_cast<unsigned char>(result[i+9])) &&
            isdigit(static_cast<unsigned char>(result[i+10]))) {
            result.replace(i, 11, "[REDACTED_SSN]");
            i += 13;
        }
    }

    return result;
}

void Logger::log(LogLevel level, const std::string& component, const std::string& message) {
    if (level < m_minLevel) return;

    FastLockGuard lock(m_mutex);

    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;

    std::stringstream timeStr;
    timeStr << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%S")
            << '.' << std::setfill('0') << std::setw(3) << ms.count() << "Z";

    const char* levelStr = "INFO";
    switch (level) {
        case LogLevel::Debug:    levelStr = "DEBUG"; break;
        case LogLevel::Info:     levelStr = "INFO"; break;
        case LogLevel::Warn:     levelStr = "WARN"; break;
        case LogLevel::Error:    levelStr = "ERROR"; break;
        case LogLevel::Security: levelStr = "SECURITY"; break;
    }

    std::string sanitized = redact(message);

    std::cout << "{\"time\":\"" << timeStr.str()
              << "\",\"level\":\"" << levelStr
              << "\",\"component\":\"" << component
              << "\",\"msg\":\"" << sanitized << "\"}\n";
    std::cout.flush();
}

} // namespace remoteassist
