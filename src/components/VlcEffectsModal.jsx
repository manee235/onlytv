import React from 'react';
import { 
  X, 
  Sliders, 
  RotateCcw, 
  Sun, 
  Contrast, 
  Palette, 
  Wifi, 
  Sparkles,
  Zap
} from 'lucide-react';

export default function VlcEffectsModal({
  isOpen,
  onClose,
  videoEffects,
  onChangeEffects,
  onResetEffects,
  cachingMode,
  onChangeCachingMode
}) {
  if (!isOpen) return null;

  return (
    <div className="vlc-modal-backdrop" onClick={onClose}>
      <div className="vlc-modal-card effects-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vlc-modal-header">
          <div className="modal-title-group">
            <Sliders size={20} className="text-blue" />
            <h2>VLC Adjustments & Network Caching</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="vlc-modal-body">
          {/* Section 1: VLC Network Caching & Buffer Speed */}
          <div className="effects-section">
            <div className="section-title">
              <Zap size={16} className="text-blue" />
              <span>Network Caching & Buffer Engine (VLC-Grade)</span>
            </div>
            <p className="section-hint">
              Controls how aggressively OnlyTV pre-buffers stream packets before playing:
            </p>

            <div className="caching-options-grid">
              <div 
                className={`caching-card ${cachingMode === 'low' ? 'active' : ''}`}
                onClick={() => onChangeCachingMode('low')}
              >
                <div className="caching-header">
                  <span className="caching-name">Lowest Latency</span>
                  <span className="caching-badge">300ms</span>
                </div>
                <p>Starts broadcast almost instantly. Best for fast internet & live sports.</p>
              </div>

              <div 
                className={`caching-card ${cachingMode === 'normal' ? 'active' : ''}`}
                onClick={() => onChangeCachingMode('normal')}
              >
                <div className="caching-header">
                  <span className="caching-name">Normal (Default)</span>
                  <span className="caching-badge">1000ms</span>
                </div>
                <p>Balanced buffering. Fast start with smooth stability across channels.</p>
              </div>

              <div 
                className={`caching-card ${cachingMode === 'high' ? 'active' : ''}`}
                onClick={() => onChangeCachingMode('high')}
              >
                <div className="caching-header">
                  <span className="caching-name">High Caching</span>
                  <span className="caching-badge">3000ms</span>
                </div>
                <p>Extended safety buffer. Prevents stuttering on weak mobile data connections.</p>
              </div>
            </div>
          </div>

          <div className="info-divider"></div>

          {/* Section 2: Video Effects (Brightness, Contrast, Saturation, Hue) */}
          <div className="effects-section">
            <div className="section-title">
              <Sliders size={16} className="text-blue" />
              <span>Video Adjustments & Filters (Ctrl+E)</span>
            </div>

            <div className="sliders-stack">
              {/* Brightness */}
              <div className="effect-slider-row">
                <div className="effect-slider-label">
                  <Sun size={15} />
                  <span>Brightness</span>
                  <span className="effect-val">{Math.round(videoEffects.brightness * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={videoEffects.brightness}
                  onChange={(e) => onChangeEffects('brightness', parseFloat(e.target.value))}
                  className="vlc-range-slider"
                />
              </div>

              {/* Contrast */}
              <div className="effect-slider-row">
                <div className="effect-slider-label">
                  <Contrast size={15} />
                  <span>Contrast</span>
                  <span className="effect-val">{Math.round(videoEffects.contrast * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={videoEffects.contrast}
                  onChange={(e) => onChangeEffects('contrast', parseFloat(e.target.value))}
                  className="vlc-range-slider"
                />
              </div>

              {/* Saturation */}
              <div className="effect-slider-row">
                <div className="effect-slider-label">
                  <Palette size={15} />
                  <span>Saturation</span>
                  <span className="effect-val">{Math.round(videoEffects.saturate * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="2.0"
                  step="0.1"
                  value={videoEffects.saturate}
                  onChange={(e) => onChangeEffects('saturate', parseFloat(e.target.value))}
                  className="vlc-range-slider"
                />
              </div>

              {/* Hue Rotate */}
              <div className="effect-slider-row">
                <div className="effect-slider-label">
                  <Sparkles size={15} />
                  <span>Hue Angle</span>
                  <span className="effect-val">{videoEffects.hue}deg</span>
                </div>
                <input 
                  type="range"
                  min="-180"
                  max="180"
                  step="10"
                  value={videoEffects.hue}
                  onChange={(e) => onChangeEffects('hue', parseInt(e.target.value, 10))}
                  className="vlc-range-slider"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: '1.25rem' }}>
            <button className="vlc-btn secondary" onClick={onResetEffects}>
              <RotateCcw size={14} /> Reset Video Effects
            </button>
            <button className="vlc-btn primary" onClick={onClose}>
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
