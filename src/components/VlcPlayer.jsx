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
  Zap
} from 'lucide-react';
import ankaSign from '../assets/anka-sign.png';
import ankaText from '../assets/anka-logo.png';
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
  cachingMode = 'low',
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
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
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
  const hasInteractedRef = useRef(false);

  // Global User Gesture Listener to auto-unmute cleanly
  useEffect(() => {
    const handleFirstGesture = () => {
      hasInteractedRef.current = true;
      setHasUserInteracted(true);
      if (videoRef.current && videoRef.current.muted && needsUserUnmute) {
        videoRef.current.muted = false;
        setIsMuted(false);
        setNeedsUserUnmute(false);
      }
    };

    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, [needsUserUnmute, videoRef]);

  // Safe Autoplay execution that complies with browser autoplay policy without errors
  const safeAutoplay = (video) => {
    if (!video) return;

    // If user has not interacted with page yet, browser strictly requires muted autoplay
    if (!hasInteractedRef.current) {
      video.muted = true;
      setIsMuted(true);
      setNeedsUserUnmute(true);
    }

    const promise = video.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          // If unmuted attempt was rejected, fallback to muted autoplay silently
          if (!video.muted) {
            video.muted = true;
            setIsMuted(true);
            setNeedsUserUnmute(true);
            video.play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
        });
    }
  };

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

    if (isHlsStream && Hls.isSupported()) {
      // Configure buffer parameters based on VLC caching mode
      const isLow = cachingMode === 'low';
      const isHigh = cachingMode === 'high';
      // Low latency buffering thresholds (300ms - 1500ms edge)
      const bufferLen = isLow ? 6 : isHigh ? 24 : 12;
      const maxBufferLen = isLow ? 12 : isHigh ? 48 : 24;
      const syncCount = isLow ? 2 : isHigh ? 4 : 3;

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        
        // VLC-Style Rapid Caching & Ultra-Low Latency
        maxBufferLength: bufferLen,
        maxMaxBufferLength: maxBufferLen,
        maxBufferSize: 40 * 1000 * 1000,
        maxBufferHole: 0.5,
        
        // Live sync cushion: 2 segments ensures playback never starves while encoder writes
        liveSyncDurationCount: syncCount,
        liveMaxLatencyDurationCount: isLow ? 4 : 6,
        
        // Progressive demuxing & parallel prefetching for zero-latency start
        progressive: true,
        startFragPrefetch: true,
        testBandwidth: false,
        initialLiveManifestSize: 1,
        autoStartLoad: true,
        backBufferLength: 4,
        
        // Fast watchdog and playhead nudge on packet gap
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 10,
        
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 300,
        levelLoadingTimeOut: 8000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 300
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsBuffering(false);
        setHasError(false);

        // Extract available quality levels with user-friendly resolution names (1080p, 720p, 480p, 360p)
        if (data && data.levels && data.levels.length > 0) {
          const lvls = data.levels.map((lvl, index) => {
            let height = lvl.height || 0;
            const bitrate = lvl.bitrate || 0;
            const kbps = Math.round(bitrate / 1000);

            // Infer standard video resolution for non-IT users if height is missing
            if (!height || height <= 0) {
              if (kbps >= 2000) {
                height = 1080;
              } else if (kbps >= 1300) {
                height = 720;
              } else if (kbps >= 800) {
                height = 480;
              } else if (kbps >= 450) {
                height = 360;
              } else if (kbps > 0) {
                height = 240;
              } else if (data.levels.length > 1) {
                const ratio = index / (data.levels.length - 1);
                if (ratio >= 0.75) height = 1080;
                else if (ratio >= 0.5) height = 720;
                else if (ratio >= 0.25) height = 480;
                else height = 360;
              } else {
                height = 720;
              }
            }

            let badge = `${height}p`;
            let title = `${height}p`;

            if (height >= 2160) {
              badge = '4K';
              title = '4K (Ultra HD)';
            } else if (height >= 1440) {
              badge = '1440p';
              title = '1440p (2K HD)';
            } else if (height >= 1080) {
              badge = '1080p';
              title = '1080p (Full HD)';
            } else if (height >= 720) {
              badge = '720p';
              title = '720p (HD)';
            } else if (height >= 576) {
              badge = '576p';
              title = '576p (SD)';
            } else if (height >= 480) {
              badge = '480p';
              title = '480p (Standard)';
            } else if (height >= 360) {
              badge = '360p';
              title = '360p (Medium)';
            } else {
              badge = '240p';
              title = '240p (Data Saver)';
            }

            return {
              id: index,
              height,
              bitrate,
              badge,
              title
            };
          });
          setQualityLevels(lvls);
        }

        safeAutoplay(video);
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

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (!attemptedProxyFallback) {
              attemptedProxyFallback = true;
              const fallbackUrl = getProxiedStreamUrl(channel.url, true);
              if (fallbackUrl !== streamUrl) {
                hls.loadSource(fallbackUrl);
                hls.startLoad();
                return;
              }
            }
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setErrorMessage('This channel broadcast is currently offline or unreachable.');
            setHasError(true);
            setIsBuffering(false);
            hls.destroy();
            break;
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      safeAutoplay(video);
    } else {
      video.src = streamUrl;
      safeAutoplay(video);
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
      video.play().catch(() => {});
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
      hasInteractedRef.current = true;
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
    hasInteractedRef.current = true;
    if (videoRef.current) {
      videoRef.current.volume = Math.min(val, 1);
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      setNeedsUserUnmute(false);
      hasInteractedRef.current = true;
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
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
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
    } catch {}
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
      link.download = `anka-snapshot-${channel?.name?.replace(/[^a-z0-9]/gi, '_') || 'stream'}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setSnapshotFlash(true);
      setTimeout(() => setSnapshotFlash(false), 300);
    } catch {
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
            muted={isMuted}
          />
        ) : (
          <div className="vlc-empty-stage">
            <div className="anka-hero-wrapper">
              <img src={ankaSign} alt="ANKA Sign" className="anka-hero-sign" />
              <img src={ankaText} alt="ANKA TV" className="anka-hero-text" />
            </div>
            <p>Select any channel from the playlist to begin streaming.</p>
          </div>
        )}

        {/* Buffering Spinner with Speed Indicator */}
        {isBuffering && (
          <div className="vlc-loader-overlay">
            <div className="vlc-spinner"></div>
            <div className="buffer-speed-badge">
              <Zap size={14} className="text-blue" />
              <span>VLC Fast Buffer Active ({cachingMode === 'low' ? '300ms Turbo' : cachingMode === 'high' ? '3000ms Stable' : '1000ms Normal'})</span>
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
                    <span className="buffer-health-pill hide-mobile" title="VLC Cached Buffer Ahead of Playhead">
                      ⚡ {bufferHealth.toFixed(1)}s cached
                    </span>
                  )}
                </div>
              </div>
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
              <div className="live-channel-current">{channel?.name || 'ANKA'}</div>
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
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button 
              className="vlc-ctrl-btn"
              onClick={handleStop}
              title="Stop (S)"
              aria-label="Stop"
            >
              <Square size={16} />
            </button>

            <button 
              className="vlc-ctrl-btn"
              onClick={onPrevChannel}
              title="Previous Channel (P)"
              aria-label="Previous Channel"
            >
              <SkipBack size={16} />
            </button>

            <button 
              className="vlc-ctrl-btn"
              onClick={onNextChannel}
              title="Next Channel (N)"
              aria-label="Next Channel"
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
                aria-label="Toggle Mute"
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
                    {currentLevel === -1 ? 'AUTO' : qualityLevels.find(l => l.id === currentLevel)?.badge || 'HD'}
                  </span>
                </button>
                {showQualityMenu && (
                  <div className="quality-dropdown-popover">
                    <button 
                      className={currentLevel === -1 ? 'active' : ''}
                      onClick={() => handleSelectQuality(-1)}
                    >
                      <span>Auto (Best Quality)</span>
                      {currentLevel === -1 && <span className="quality-check">✓</span>}
                    </button>
                    {qualityLevels.map(lvl => (
                      <button 
                        key={lvl.id}
                        className={currentLevel === lvl.id ? 'active' : ''}
                        onClick={() => handleSelectQuality(lvl.id)}
                      >
                        <span>{lvl.title}</span>
                        {currentLevel === lvl.id && <span className="quality-check">✓</span>}
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
