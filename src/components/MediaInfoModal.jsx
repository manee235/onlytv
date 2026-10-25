import React, { useState } from 'react';
import { X, Info, Copy, Check, Tv, Radio, Monitor, ShieldCheck, FileVideo } from 'lucide-react';

export default function MediaInfoModal({
  isOpen,
  onClose,
  channel,
  videoRef,
  aspectRatio,
  playbackSpeed
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const video = videoRef?.current;
  const resolution = video && video.videoWidth ? `${video.videoWidth} × ${video.videoHeight}` : 'Dynamic / Adaptive';
  const readyStateMap = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
  const bufferState = video ? readyStateMap[video.readyState] || 'Ready' : 'Idle';

  const handleCopyUrl = () => {
    if (!channel?.url) return;
    navigator.clipboard.writeText(channel.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="vlc-modal-backdrop" onClick={onClose}>
      <div className="vlc-modal-card info-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vlc-modal-header">
          <div className="modal-title-group">
            <Info size={20} className="text-orange" />
            <h2>Current Media Information</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="vlc-modal-body">
          {channel ? (
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">Title / Channel</span>
                <span className="info-val font-semibold">{channel.name}</span>
              </div>

              <div className="info-row">
                <span className="info-label">Group / Category</span>
                <span className="info-val badge-category">{channel.group || 'General'}</span>
              </div>

              <div className="info-row">
                <span className="info-label">Stream Source URL</span>
                <div className="stream-url-container">
                  <span className="info-val text-mono truncate">{channel.url}</span>
                  <button className="copy-btn" onClick={handleCopyUrl} title="Copy Stream URL">
                    {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="info-divider"></div>

              <div className="info-stats-grid">
                <div className="stat-card">
                  <div className="stat-icon"><Monitor size={16} /></div>
                  <div className="stat-meta">
                    <span className="stat-name">Resolution</span>
                    <span className="stat-val">{resolution}</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon"><FileVideo size={16} /></div>
                  <div className="stat-meta">
                    <span className="stat-name">Aspect Ratio</span>
                    <span className="stat-val">{aspectRatio.toUpperCase()}</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon"><Radio size={16} /></div>
                  <div className="stat-meta">
                    <span className="stat-name">Buffer Status</span>
                    <span className="stat-val">{bufferState}</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon"><ShieldCheck size={16} /></div>
                  <div className="stat-meta">
                    <span className="stat-name">Playback Speed</span>
                    <span className="stat-val">{playbackSpeed}x</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="info-empty">
              <Tv size={36} className="text-muted" />
              <p>No media is currently playing.</p>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <button className="vlc-btn primary" onClick={onClose}>
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
