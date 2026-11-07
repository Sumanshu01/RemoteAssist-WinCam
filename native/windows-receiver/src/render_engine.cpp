#include "remoteassist/render_engine.hpp"
#include <iostream>

namespace remoteassist {

RenderEngine::RenderEngine() = default;

RenderEngine::~RenderEngine() {
    shutdown();
}

#ifdef _WIN32
StatusCode RenderEngine::initialize(HWND targetWindow, uint32_t width, uint32_t height) {
    m_hwnd = targetWindow;
    m_width = width;
    m_height = height;

    if (!m_hwnd) {
        // Headless / offscreen test mode
        m_isInitialized = true;
        return StatusCode::Success;
    }

#if defined(REMOTEASSIST_HAS_D3D11)
    // Direct3D 11 initialization
    DXGI_SWAP_CHAIN_DESC scd = {};
    scd.BufferCount = 2;
    scd.BufferDesc.Width = width;
    scd.BufferDesc.Height = height;
    scd.BufferDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    scd.BufferDesc.RefreshRate.Numerator = 60;
    scd.BufferDesc.RefreshRate.Denominator = 1;
    scd.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    scd.OutputWindow = targetWindow;
    scd.SampleDesc.Count = 1;
    scd.Windowed = TRUE;
    scd.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;

    D3D_FEATURE_LEVEL featureLevels[] = {
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
    };
    D3D_FEATURE_LEVEL featureLevel;

    HRESULT hr = D3D11CreateDeviceAndSwapChain(
        nullptr,
        D3D_DRIVER_TYPE_HARDWARE,
        nullptr,
        0,
        featureLevels,
        2,
        D3D11_SDK_VERSION,
        &scd,
        &m_swapChain,
        &m_d3dDevice,
        &featureLevel,
        &m_d3dContext
    );

    if (FAILED(hr)) {
        // Fallback to WARP (software rasterizer for Windows VMs without dedicated GPU)
        hr = D3D11CreateDeviceAndSwapChain(
            nullptr,
            D3D_DRIVER_TYPE_WARP,
            nullptr,
            0,
            featureLevels,
            2,
            D3D11_SDK_VERSION,
            &scd,
            &m_swapChain,
            &m_d3dDevice,
            &featureLevel,
            &m_d3dContext
        );
    }

    if (SUCCEEDED(hr)) {
        ID3D11Texture2D* pBackBuffer = nullptr;
        m_swapChain->GetBuffer(0, __uuidof(ID3D11Texture2D), (LPVOID*)&pBackBuffer);
        if (pBackBuffer) {
            m_d3dDevice->CreateRenderTargetView(pBackBuffer, nullptr, &m_renderTargetView);
            pBackBuffer->Release();
        }
        m_isInitialized = true;
        return StatusCode::Success;
    }
#endif

    m_isInitialized = true;
    return StatusCode::Success;
}
#else
StatusCode RenderEngine::initialize(void* /*targetWindow*/, uint32_t width, uint32_t height) {
    m_width = width;
    m_height = height;
    m_isInitialized = true;
    return StatusCode::Success;
}
#endif

void RenderEngine::shutdown() {
#ifdef _WIN32
#if defined(REMOTEASSIST_HAS_D3D11)
    if (m_renderTargetView) {
        m_renderTargetView->Release();
        m_renderTargetView = nullptr;
    }
    if (m_swapChain) {
        m_swapChain->Release();
        m_swapChain = nullptr;
    }
    if (m_d3dContext) {
        m_d3dContext->Release();
        m_d3dContext = nullptr;
    }
    if (m_d3dDevice) {
        m_d3dDevice->Release();
        m_d3dDevice = nullptr;
    }
#endif
#endif
    m_isInitialized = false;
}

StatusCode RenderEngine::renderFrame(const VideoFrame& /*frame*/) {
    if (!m_isInitialized) {
        return StatusCode::InvalidParameter;
    }

#ifdef _WIN32
#if defined(REMOTEASSIST_HAS_D3D11)
    if (m_d3dContext && m_renderTargetView && m_swapChain) {
        const float clearColor[4] = {0.05f, 0.05f, 0.1f, 1.0f};
        m_d3dContext->ClearRenderTargetView(m_renderTargetView, clearColor);
        m_swapChain->Present(1, 0); // V-sync
    }
#endif
#endif

    return StatusCode::Success;
}

void RenderEngine::resize(uint32_t width, uint32_t height) {
    m_width = width;
    m_height = height;
}

} // namespace remoteassist
