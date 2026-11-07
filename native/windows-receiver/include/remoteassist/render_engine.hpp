#pragma once

#include "common.hpp"
#include <memory>

#ifdef _WIN32
#include <windows.h>
#if defined(__has_include)
#if __has_include(<d3d11.h>)
#define REMOTEASSIST_HAS_D3D11 1
#include <d3d11.h>
#include <dxgi.h>
#endif
#elif defined(_MSC_VER)
#define REMOTEASSIST_HAS_D3D11 1
#include <d3d11.h>
#include <dxgi.h>
#endif
#endif

namespace remoteassist {

class RenderEngine {
public:
    RenderEngine();
    ~RenderEngine();

#ifdef _WIN32
    StatusCode initialize(HWND targetWindow, uint32_t width, uint32_t height);
#else
    StatusCode initialize(void* targetWindow, uint32_t width, uint32_t height);
#endif
    void shutdown();

    StatusCode renderFrame(const VideoFrame& frame);
    void resize(uint32_t width, uint32_t height);

private:
#ifdef _WIN32
    HWND m_hwnd{nullptr};
#if defined(REMOTEASSIST_HAS_D3D11)
    ID3D11Device* m_d3dDevice{nullptr};
    ID3D11DeviceContext* m_d3dContext{nullptr};
    IDXGISwapChain* m_swapChain{nullptr};
    ID3D11RenderTargetView* m_renderTargetView{nullptr};
#else
    void* m_d3dDevice{nullptr};
    void* m_d3dContext{nullptr};
    void* m_swapChain{nullptr};
    void* m_renderTargetView{nullptr};
#endif
#endif
    uint32_t m_width{1920};
    uint32_t m_height{1080};
    bool m_isInitialized{false};
};

} // namespace remoteassist
