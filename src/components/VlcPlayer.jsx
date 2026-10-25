import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Volume1, 
  VolumeX, 
  Maximize, 
  Minimize, 
  PictureInPicture2, 
  Camera, 
  AlertCircle, 
  RefreshCw, 
  Tv, 
  ShieldCheck, 
  List, 
  Layers,
  Sliders,
  Zap,
  Gauge
} from 'lucide-react';
import appLogo from '../assets/Cyan Blue Winged Play Logo.png';
import { getProxiedStreamUrl } from '../utils/m3uParser';

export default function VlcPlayer({
  channel,
  onNextChannel,
  onPrevChannel,
  onTogglePlaylist,
  isPlaylistOpen,
  aspectRatio,
  onChangeAspectRatio,
  playbackSpeed,
  onChangeSpeed,
  onTakeSnapshot,
  videoRef,
  videoEffects = { brightness: 1, contrast: 1, saturate: 1, hue: 0 },
  cachingMode = 'normal',
  onChangeCachingMode,
  onOpenEffectsModal
}) {
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [needsUserUnmute, setNeedsUserUnmute] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [snapshotFlash, setSnapshotFlash] = useState(false);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const hideTimeoutRef = useRef(null);

  // Initialize and load stream with VLC-grade low-latency network caching
  useEffect(() => {
    if (!channel || !channel.url) return;

    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setErrorMessage('');
    setIsBuffering(true);
    setQualityLevels([]);
    setCurrentLevel(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Dynamic stream URL based on environment (direct CDN on web, /api/proxy on localhost)
    let streamUrl = getProxiedStreamUrl(channel.url);
    let attemptedProxyFallback = false;

    const isHlsStream = streamUrl.includes('.m3u8') || 
                        streamUrl.includes('/hls') || 
                        streamUrl.includes('proxy') ||
                        !streamUrl.match(/\.(mp4|webm|ogg)$/i);

    const attemptAutoplay = () => {
      video.play().catch(err => {
        console.warn('Autoplay unmuted blocked by browser policy, switching to muted autoplay:', err);
        video.muted = true;
        setIsMuted(true);
        setNeedsUserUnmute(true);
        video.play().catch(e => {
          console.warn('Muted autoplay also prevented:', e);
          setIsPlaying(false);
        });
      });
    };

    if (isHlsStream && Hls.isSupported()) {
      // Configure buffer parameters based on VLC caching mode
      const isLow = cachingMode === 'low';
      const isHigh = cachingMode === 'high';
      // Balanced healthy buffer thresholds: eliminates buffer starvation on live chunks
      const bufferLen = isLow ? 10 : isHigh ? 32 : 20;
      const maxBufferLen = isLow ? 20 : isHigh ? 64 : 40;
      const syncCount = isLow ? 2 : isHigh ? 4 : 3;

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        
        // VLC-Style Rapid Caching Configuration
        maxBufferLength: bufferLen,
        maxMaxBufferLength: maxBufferLen,
        maxBufferSize: 50 * 1000 * 1000,
        maxBufferHole: 0.5,
        
        // Live sync cushion: 2-3 segments ensures playback never starves while encoder writes
        liveSyncDurationCount: syncCount,
        liveMaxLatencyDurationCount: 8,
        
        // Progressive demuxing & parallel prefetching for zero-latency start
        progressive: true,
        startFragPrefetch: true,
        testBandwidth: false,
        initialLiveManifestSize: 1,
        autoStartLoad: true,
        backBufferLength: 10,
        
        // Fast watchdog and playhead nudge on packet gap
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 10,
        
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 500,
        levelLoadingTimeOut: 12000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 500
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsBuffering(false);
        setHasError(false);

        // Extract available quality levels
        if (data && data.levels && data.levels.length > 0) {
          const lvls = data.levels.map((lvl, index) => ({
            id: index,
            height: lvl.height,
            bitrate: lvl.bitrate,
            label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`
          }));
          setQualityLevels(lvls);
        }

        attemptAutoplay();
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsBuffering(false);
        if (video.paused && !needsUserUnmute) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        setIsLive(data.details.live);
        if (data.details.totalduration) {
          setDuration(data.details.totalduration);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;

        console.warn('Fatal HLS error:', data.type, data.details);
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // If direct stream URL failed on web deployment, automatically failover to proxy!
            if (!attemptedProxyFallback) {
              attemptedProxyFallback = true;
              const fallbackUrl = getProxiedStreamUrl(channel.url, true);
              if (fallbackUrl !== streamUrl) {
                console.log('Direct stream CORS error on web, switching to fallback proxy:', fallbackUrl);
                hls.loadSource(fallbackUrl);
                hls.startLoad();
                return;
              }
            }
            console.log('Attempting VLC network recovery...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('Attempting VLC media error recovery...');
            hls.recoverMediaError();
            break;
          default:
            setErrorMessage('This channel broadcast is currently offline or geoblocked.');
            setHasError(true);
            setIsBuffering(false);
            hls.destroy();
            break;
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      attemptAutoplay();
    } else {
      video.src = streamUrl;
      attemptAutoplay();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel, cachingMode]);

  // Video event listeners & buffer health monitor
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let waitTimer = null;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => {
      clearTimeout(waitTimer);
      // Debounce buffering: only show spinner if stalled for more than 400ms
      waitTimer = setTimeout(() => {
        setIsBuffering(true);
      }, 400);
    };
    const onPlaying = () => {
      clearTimeout(waitTimer);
      setIsBuffering(false);
      setHasError(false);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration);
      }

      // Calculate buffer health in seconds ahead of playhead
      if (video.buffered && video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
            const ahead = video.buffered.end(i) - video.currentTime;
            setBufferHealth(ahead);
            if (ahead > 0.4) {
              clearTimeout(waitTimer);
              setIsBuffering(false);
            }
            break;
          }
        }
      }
    };
    const onError = () => {
      if (!hlsRef.current && video.src) {
        clearTimeout(waitTimer);
        setIsBuffering(false);
        setHasError(true);
        setErrorMessage('Channel stream offline or unavailable.');
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('error', onError);

    return () => {
      clearTimeout(waitTimer);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('error', onError);
    };
  }, []);

  // Update speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowQualityMenu(false);
      }, 3500);
    }
  };

  const handleMouseMove = () => showControlsTemporarily();

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (needsUserUnmute) {
      handleUserUnmute();
    }
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleUserUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = Math.min(volume || 1, 1);
      setIsMuted(false);
      setNeedsUserUnmute(false);
    }
  };

  const handleStop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setIsPlaying(false);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setNeedsUserUnmute(false);
    if (videoRef.current) {
      videoRef.current.volume = Math.min(val, 1);
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      setNeedsUserUnmute(false);
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleSelectQuality = (lvlIndex) => {
    setCurrentLevel(lvlIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlIndex;
    }
    setShowQualityMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  const handleSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const link = document.createElement('a');
      link.download = `onlytv-snapshot-${channel?.name?.replace(/[^a-z0-9]/gi, '_') || 'stream'}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setSnapshotFlash(true);
      setTimeout(() => setSnapshotFlash(false), 300);
    } catch (e) {
      console.error('Snapshot failed:', e);
      alert('Snapshot failed: Stream origin restrictions prevented screenshot capture.');
    }
  };

  const cycleCachingMode = () => {
    const modes = ['low', 'normal', 'high'];
    const next = modes[(modes.indexOf(cachingMode) + 1) % modes.length];
    if (onChangeCachingMode) onChangeCachingMode(next);
  };

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    if (onChangeSpeed) onChangeSpeed(next);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Video aspect ratio & effects filter style
  const getVideoStyles = () => {
    const styles = {
      filter: `brightness(${videoEffects.brightness}) contrast(${videoEffects.contrast}) saturate(${videoEffects.saturate}) hue-rotate(${videoEffects.hue}deg)`
    };

    switch (aspectRatio) {
      case '16:9': return { ...styles, aspectRatio: '16 / 9', objectFit: 'contain' };
      case '4:3': return { ...styles, aspectRatio: '4 / 3', objectFit: 'contain' };
      case 'cover': return { ...styles, objectFit: 'cover' };
      case 'fill': return { ...styles, objectFit: 'fill' };
      default: return { ...styles, objectFit: 'contain' };
    }
  };

  return (
    <div 
      className={`vlc-player-container ${isFullscreen ? 'fullscreen' : ''} ${controlsVisible ? 'show-controls' : 'hide-controls'}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onClick={showControlsTemporarily}
    >
      {snapshotFlash && <div className="vlc-snapshot-flash" />}

      {/* Video Viewport */}
      <div className="vlc-viewport">
        {channel ? (
          <video
            ref={videoRef}
            className="vlc-video-element"
            style={getVideoStyles()}
            playsInline
            webkit-playsinline="true"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="vlc-empty-stage">
            <div className="onlytv-hero-wrapper">
              <img src={appLogo} alt="OnlyTV" className="onlytv-hero-logo" />
            </div>
            <h2>OnlyTV Web Player</h2>
            <p>Insert a live streaming link, M3U playlist, or select any channel from the sidebar.</p>
          </div>
        )}

        {/* Buffering Spinner with Speed Indicator */}
        {isBuffering && (
          <div className="vlc-loader-overlay">
            <div className="vlc-spinner"></div>
            <div className="buffer-speed-badge">
              <Zap size={14} className="text-blue" />
              <span>VLC Fast Buffer Active ({cachingMode === 'low' ? '300ms' : cachingMode === 'high' ? '3000ms' : '1000ms'})</span>
            </div>
          </div>
        )}

        {/* Browser Autoplay Muted Floating Prompt */}
        {needsUserUnmute && !hasError && (
          <div className="vlc-unmute-prompt" onClick={handleUserUnmute}>
            <VolumeX size={18} className="text-blue" />
            <span>Audio Muted — Tap to Unmute</span>
          </div>
        )}

        {/* Error Notification Overlay */}
        {hasError && (
          <div className="vlc-error-overlay">
            <AlertCircle size={38} className="text-red" />
            <h3>Broadcast Unavailable</h3>
            <p>{errorMessage}</p>
            <div className="vlc-error-actions">
              <button 
                className="vlc-btn primary"
                onClick={onNextChannel}
              >
                <SkipForward size={15} /> Skip to Next Channel
              </button>
              <button 
                className="vlc-btn secondary"
                onClick={() => {
                  setHasError(false);
                  setIsBuffering(true);
                  if (hlsRef.current) {
                    hlsRef.current.startLoad();
                  } else if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
              >
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Top Floating Channel Info Banner */}
        {channel && (
          <div className="vlc-top-overlay">
            <div className="channel-live-info">
              {channel.logo ? (
                <img 
                  src={channel.logo} 
                  alt={channel.name} 
                  className="channel-overlay-logo"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="channel-overlay-fallback"><Tv size={16} /></div>
              )}
              <div className="channel-text-meta">
                <div className="channel-name-row">
                  <span className="channel-title">{channel.name}</span>
                  {isLive ? (
                    <span className="badge-live"><span className="pulse-dot"></span> LIVE</span>
                  ) : (
                    <span className="badge-vod">VOD</span>
                  )}
                  {channel.quality && <span className="badge-quality">{channel.quality}</span>}
                </div>
                <div className="channel-sub-row">
                  <span className="channel-group">{channel.group || 'Live TV'}</span>
                  <span className="proxy-indicator">
                    <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    Anti-CORS Active
                  </span>

                  {/* VLC Caching Mode Quick Pill */}
                  <button 
                    className="caching-quick-pill" 
                    onClick={cycleCachingMode} 
                    title="VLC Network Caching (Click to cycle 300ms / 1000ms / 3000ms)"
                  >
                    <Zap size={11} className={cachingMode === 'low' ? 'text-blue' : cachingMode === 'high' ? 'text-amber' : 'text-green'} />
                    <span>{cachingMode === 'low' ? '300ms Turbo' : cachingMode === 'high' ? '3000ms Stable' : '1000ms Normal'}</span>
                  </button>

                  {bufferHealth > 0 && (
                    <span className="buffer-health-pill" title="VLC Cached Buffer Ahead of Playhead">
                      ⚡ {bufferHealth.toFixed(1)}s cached
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="top-right-overlay-controls">
              <button 
                className={`overlay-icon-btn ${isPlaylistOpen ? 'active' : ''}`}
                onClick={onTogglePlaylist}
                title="Channel List"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* VLC Bottom Controls Panel */}
      <div className="vlc-controls-panel">
        <div className="vlc-timeline-bar">
          {isLive ? (
            <div className="vlc-live-progress">
              <div className="live-pill">
                <span className="live-dot"></span> LIVE BROADCAST
              </div>
              <div className="live-channel-current">{channel?.name || 'OnlyTV'}</div>
            </div>
          ) : (
            <div className="vlc-seek-wrapper">
              <input 
                type="range"
                className="vlc-seek-slider"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
              />
              <div className="vlc-time-text">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="vlc-toolbar-row">
          <div className="vlc-controls-left">
            <button 
              className="vlc-ctrl-btn play-btn"
              onClick={handlePlayPause}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button 
              className="vlc-ctrl-btn"
              onClick={handleStop}
              title="Stop (S)"
            >
              <Square size={16} />
            </button>

            <button 
              className="vlc-ctrl-btn"
              onClick={onPrevChannel}
              title="Previous Channel (P)"
            >
              <SkipBack size={16} />
            </button>

            <button 
              className="vlc-ctrl-btn"
              onClick={onNextChannel}
              title="Next Channel (N)"
            >
              <SkipForward size={16} />
            </button>
          </div>

          <div className="vlc-controls-center">
            <div className="vlc-volume-group">
              <button 
                className="vlc-volume-btn"
                onClick={toggleMute}
                title="Mute / Unmute (M)"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={18} className="text-red" />
                ) : volume < 0.5 ? (
                  <Volume1 size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>

              <div className="vlc-volume-slider-container">
                <input 
                  type="range"
                  className="vlc-volume-slider"
                  min="0"
                  max="1.25"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                />
              </div>

              <span className={`vlc-volume-badge ${volume > 1 ? 'boost' : ''}`}>
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>

          <div className="vlc-controls-right">
            {/* VLC Quality Selector */}
            {qualityLevels.length > 0 && (
              <div className="quality-selector-wrap">
                <button 
                  className="vlc-ctrl-btn hide-small"
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  title="Stream Quality (Resolution)"
                >
                  <span className="speed-label">
                    {currentLevel === -1 ? 'AUTO' : qualityLevels[currentLevel]?.label || 'HD'}
                  </span>
                </button>
                {showQualityMenu && (
                  <div className="quality-dropdown-popover">
                    <button 
                      className={currentLevel === -1 ? 'active' : ''}
                      onClick={() => handleSelectQuality(-1)}
                    >
                      Auto (Adaptive)
                    </button>
                    {qualityLevels.map(lvl => (
                      <button 
                        key={lvl.id}
                        className={currentLevel === lvl.id ? 'active' : ''}
                        onClick={() => handleSelectQuality(lvl.id)}
                      >
                        {lvl.label} {lvl.bitrate ? `(${Math.round(lvl.bitrate / 1000)} kbps)` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VLC Speed Selector */}
            <button 
              className="vlc-ctrl-btn hide-small"
              onClick={cycleSpeed}
              title={`VLC Playback Speed: ${playbackSpeed}x (Click to cycle)`}
            >
              <span className="speed-label">{playbackSpeed}x</span>
            </button>

            {/* VLC Adjustments and Effects (Ctrl+E) */}
            <button 
              className="vlc-ctrl-btn hide-small"
              onClick={onOpenEffectsModal}
              title="VLC Adjustments & Network Caching (Ctrl+E)"
            >
              <Sliders size={16} />
            </button>

            {/* Aspect Ratio */}
            <button 
              className="vlc-ctrl-btn hide-small"
              onClick={() => {
                const ratios = ['default', '16:9', '4:3', 'cover'];
                const nextIndex = (ratios.indexOf(aspectRatio) + 1) % ratios.length;
                onChangeAspectRatio(ratios[nextIndex]);
              }}
              title={`Aspect Ratio: ${aspectRatio}`}
            >
              <Layers size={16} />
            </button>

            {/* Snapshot */}
            <button 
              className="vlc-ctrl-btn"
              onClick={handleSnapshot}
              title="Take Video Snapshot"
            >
              <Camera size={16} />
            </button>

            {/* PiP */}
            <button 
              className="vlc-ctrl-btn hide-small"
              onClick={togglePiP}
              title="Picture in Picture"
            >
              <PictureInPicture2 size={16} />
            </button>

            {/* Fullscreen */}
            <button 
              className="vlc-ctrl-btn"
              onClick={toggleFullscreen}
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
