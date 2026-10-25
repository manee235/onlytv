import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  FileText, 
  Upload, 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Link,
  Tv
} from 'lucide-react';
import appLogo from '../assets/Cyan Blue Winged Play Logo.png';
import { SAMPLE_PLAYLISTS, parseM3U, DEFAULT_IPTV_URL } from '../utils/m3uParser';

export default function NetworkStreamModal({
  isOpen,
  onClose,
  onLoadUrl,
  onLoadChannels,
  isLoading,
  error
}) {
  const [activeTab, setActiveTab] = useState('url'); // 'url', 'presets', 'file', 'raw'
  const [streamUrl, setStreamUrl] = useState(DEFAULT_IPTV_URL);
  const [rawM3U, setRawM3U] = useState('');
  const [parseStatus, setParseStatus] = useState(null);

  if (!isOpen) return null;

  const handleSubmitUrl = (e) => {
    e.preventDefault();
    if (!streamUrl.trim()) return;
    onLoadUrl(streamUrl.trim());
  };

  const handleSelectPreset = (preset) => {
    onLoadUrl(preset.url, preset.name);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const channels = parseM3U(content);
      if (channels.length > 0) {
        setParseStatus({ success: true, count: channels.length, name: file.name });
        onLoadChannels(channels, file.name);
        setTimeout(() => {
          onClose();
          setParseStatus(null);
        }, 800);
      } else {
        setParseStatus({ success: false, message: 'No valid channels found in the uploaded file.' });
      }
    };
    reader.onerror = () => {
      setParseStatus({ success: false, message: 'Failed to read file.' });
    };
    reader.readAsText(file);
  };

  const handleParseRawText = () => {
    if (!rawM3U.trim()) return;
    const channels = parseM3U(rawM3U);
    if (channels.length > 0) {
      setParseStatus({ success: true, count: channels.length, name: 'Custom M3U' });
      onLoadChannels(channels, 'Pasted M3U Stream');
      setTimeout(() => {
        onClose();
        setParseStatus(null);
      }, 800);
    } else {
      setParseStatus({ success: false, message: 'Could not parse channels. Ensure format begins with #EXTINF.' });
    }
  };

  return (
    <div className="vlc-modal-backdrop" onClick={onClose}>
      <div className="vlc-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="vlc-modal-header">
          <div className="modal-title-group">
            <img src={appLogo} alt="OnlyTV" className="onlytv-modal-logo" />
            <h2>OnlyTV - Open Media Stream / Playlist</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="vlc-modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'url' ? 'active' : ''}`}
            onClick={() => setActiveTab('url')}
          >
            <Globe size={15} />
            <span>Network URL</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            <Sparkles size={15} />
            <span>Curated Playlists</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            <Upload size={15} />
            <span>Upload File</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            <FileText size={15} />
            <span>Paste M3U</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="vlc-modal-body">
          {/* TAB 1: Network URL */}
          {activeTab === 'url' && (
            <form onSubmit={handleSubmitUrl} className="tab-pane">
              <p className="tab-hint">
                Enter an <strong>IPTV M3U playlist URL</strong> or a direct <strong>.m3u8 / .mp4</strong> live stream link:
              </p>

              <div className="url-input-container">
                <Link size={18} className="input-icon" />
                <input 
                  type="url"
                  placeholder="https://example.com/playlist.m3u or stream.m3u8"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  autoFocus
                  required
                />
                {streamUrl && (
                  <button 
                    type="button" 
                    className="clear-input-btn"
                    onClick={() => setStreamUrl('')}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Quick suggestion samples */}
              <div className="quick-suggestions">
                <span className="sug-label">Quick test links:</span>
                <button 
                  type="button"
                  className="sug-chip"
                  onClick={() => setStreamUrl('https://iptv-org.github.io/iptv/categories/news.m3u')}
                >
                  World News M3U
                </button>
                <button 
                  type="button"
                  className="sug-chip"
                  onClick={() => setStreamUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')}
                >
                  Mux Big Buck Bunny (HLS)
                </button>
                <button 
                  type="button"
                  className="sug-chip"
                  onClick={() => setStreamUrl('https://iptv-org.github.io/iptv/categories/sports.m3u')}
                >
                  Sports M3U
                </button>
              </div>

              {error && (
                <div className="modal-alert-box error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="vlc-btn secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="vlc-btn primary"
                  disabled={isLoading || !streamUrl.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Parsing Channels...</span>
                    </>
                  ) : (
                    <>
                      <span>Play & Load Channels</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Presets & Curated */}
          {activeTab === 'presets' && (
            <div className="tab-pane presets-pane">
              <p className="tab-hint">
                Select from verified public IPTV channels and live streaming broadcast playlists:
              </p>

              <div className="preset-grid">
                {SAMPLE_PLAYLISTS.map((item, index) => (
                  <div 
                    key={index} 
                    className="preset-card"
                    onClick={() => handleSelectPreset(item)}
                  >
                    <div className="preset-header">
                      <div className="preset-cat">{item.category}</div>
                      <span className="preset-count">{item.count}</span>
                    </div>
                    <h4>{item.name}</h4>
                    <p>{item.description}</p>
                    <div className="preset-footer">
                      <span>Click to Load Playlist</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: File Upload */}
          {activeTab === 'file' && (
            <div className="tab-pane file-pane">
              <p className="tab-hint">
                Load a local <strong>.m3u</strong>, <strong>.m3u8</strong>, or <strong>.txt</strong> playlist file from your computer or phone:
              </p>

              <label className="upload-dropzone">
                <input 
                  type="file" 
                  accept=".m3u,.m3u8,.txt"
                  onChange={handleFileUpload} 
                  className="file-hidden-input"
                />
                <div className="dropzone-content">
                  <div className="dropzone-icon">
                    <Upload size={32} />
                  </div>
                  <h4>Click or Drag & Drop playlist file</h4>
                  <p>Supports UTF-8 M3U playlists with channel logos & group categories</p>
                  <span className="file-format-badge">.m3u, .m3u8, .txt</span>
                </div>
              </label>

              {parseStatus && (
                <div className={`modal-alert-box ${parseStatus.success ? 'success' : 'error'}`}>
                  {parseStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>
                    {parseStatus.success 
                      ? `Successfully loaded ${parseStatus.count} channels from ${parseStatus.name}!`
                      : parseStatus.message}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Raw Text M3U */}
          {activeTab === 'raw' && (
            <div className="tab-pane raw-pane">
              <p className="tab-hint">
                Paste raw <code>#EXTM3U</code> code directly into the box below:
              </p>

              <textarea 
                className="raw-m3u-textarea"
                rows="8"
                placeholder={`#EXTM3U\n#EXTINF:-1 tvg-logo="https://..." group-title="News",CNN Live\nhttps://example.com/stream.m3u8`}
                value={rawM3U}
                onChange={(e) => setRawM3U(e.target.value)}
              />

              {parseStatus && (
                <div className={`modal-alert-box ${parseStatus.success ? 'success' : 'error'}`}>
                  {parseStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>
                    {parseStatus.success 
                      ? `Successfully parsed ${parseStatus.count} channels!`
                      : parseStatus.message}
                  </span>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="vlc-btn secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="vlc-btn primary"
                  onClick={handleParseRawText}
                  disabled={!rawM3U.trim()}
                >
                  <span>Parse & Load Channels</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
