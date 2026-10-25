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
  Layers
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
  videoRef
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
  const [autoSkipCountdown, setAutoSkipCountdown] = useState(null);

  const hideTimeoutRef = useRef(null);
  const autoSkipTimerRef = useRef(null);

  // Clear auto-skip timer if user changes channel or plays
  const clearAutoSkip = () => {
    if (autoSkipTimerRef.current) {
      clearInterval(autoSkipTimerRef.current);
      autoSkipTimerRef.current = null;
    }
    setAutoSkipCountdown(null);
  };

  // Initialize and load stream
  useEffect(() => {
    if (!channel || !channel.url) return;

    const video = videoRef.current;
    if (!video) return;

    clearAutoSkip();
    setHasError(false);
    setErrorMessage('');
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Always route through stream proxy to eliminate CORS & redirect issues
    const streamUrl = getProxiedStreamUrl(channel.url);

    const isHlsStream = streamUrl.includes('.m3u8') || 
                        streamUrl.includes('/hls') || 
                        streamUrl.includes('proxy') ||
                        !streamUrl.match(/\.(mp4|webm|ogg)$/i);

    const attemptAutoplay = () => {
      video.play().catch(err => {
        // Autoplay policy prevented unmuted playback
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
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 3
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        attemptAutoplay();
      });

      hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        setIsLive(data.details.live);
        if (data.details.totalduration) {
          setDuration(data.details.totalduration);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('HLS stream error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setErrorMessage('Broadcast feed is currently offline, geoblocked, or not responding.');
              setHasError(true);
              setIsBuffering(false);
              triggerAutoSkip();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setErrorMessage('Broadcast source unavailable.');
              setHasError(true);
              setIsBuffering(false);
              hls.destroy();
              triggerAutoSkip();
              break;
          }
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
      clearAutoSkip();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  // Auto skip to next working channel after 4 seconds if dead stream
  const triggerAutoSkip = () => {
    clearAutoSkip();
    let secondsLeft = 4;
    setAutoSkipCountdown(secondsLeft);

    autoSkipTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      setAutoSkipCountdown(secondsLeft);
      if (secondsLeft <= 0) {
        clearAutoSkip();
        onNextChannel();
      }
    }, 1000);
  };

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      clearAutoSkip();
      setHasError(false);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };
    const onError = () => {
      setIsBuffering(false);
      setHasError(true);
      setErrorMessage('Channel stream offline or unavailable.');
      triggerAutoSkip();
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('error', onError);

    return () => {
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
      videoRef.current.volume = volume || 1;
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
      link.download = `vlc-snapshot-${channel?.name?.replace(/[^a-z0-9]/gi, '_') || 'stream'}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setSnapshotFlash(true);
      setTimeout(() => setSnapshotFlash(false), 300);
    } catch (e) {
      console.error('Snapshot failed:', e);
      alert('Snapshot failed: Stream origin restrictions prevented screenshot capture.');
    }
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

  const getAspectRatioStyle = () => {
    switch (aspectRatio) {
      case '16:9': return { aspectRatio: '16 / 9', objectFit: 'contain' };
      case '4:3': return { aspectRatio: '4 / 3', objectFit: 'contain' };
      case 'cover': return { objectFit: 'cover' };
      case 'fill': return { objectFit: 'fill' };
      default: return { objectFit: 'contain' };
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
            style={getAspectRatioStyle()}
            playsInline
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

        {/* Buffering Spinner */}
        {isBuffering && (
          <div className="vlc-loader-overlay">
            <div className="vlc-spinner"></div>
            <span>Buffering Live Stream...</span>
          </div>
        )}

        {/* Browser Autoplay Muted Floating Prompt */}
        {needsUserUnmute && !hasError && (
          <div className="vlc-unmute-prompt" onClick={handleUserUnmute}>
            <VolumeX size={18} className="text-orange" />
            <span>Audio Muted (Browser Autoplay) — Tap to Unmute</span>
          </div>
        )}

        {/* Error Notification Overlay with Auto-Skip Countdown */}
        {hasError && (
          <div className="vlc-error-overlay">
            <AlertCircle size={38} className="text-red" />
            <h3>Broadcast Unavailable</h3>
            <p>{errorMessage}</p>
            {autoSkipCountdown !== null && (
              <p className="auto-skip-notice">
                Auto-skipping to next channel in <strong>{autoSkipCountdown}s</strong>...
              </p>
            )}
            <div className="vlc-error-actions">
              <button 
                className="vlc-btn primary"
                onClick={() => {
                  clearAutoSkip();
                  onNextChannel();
                }}
              >
                <SkipForward size={15} /> Skip to Next Channel Now
              </button>
              <button 
                className="vlc-btn secondary"
                onClick={() => {
                  clearAutoSkip();
                  const video = videoRef.current;
                  if (video) {
                    setHasError(false);
                    setIsBuffering(true);
                    video.load();
                  }
                }}
              >
                <RefreshCw size={15} /> Reconnect
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
                  <span className="proxy-indicator" title="VLC Stream Proxy prevents CORS & domain blocking">
                    <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    VLC Anti-CORS Active
                  </span>
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
              <div className="live-channel-current">{channel?.name || 'VLC Web Player'}</div>
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
            <button 
              className="vlc-ctrl-btn hide-small"
              onClick={() => {
                const speeds = [0.5, 1.0, 1.25, 1.5, 2.0];
                const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                onChangeSpeed(speeds[nextIndex]);
              }}
              title="Playback Speed"
            >
              <span className="speed-label">{playbackSpeed}x</span>
            </button>

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

            <button 
              className="vlc-ctrl-btn"
              onClick={handleSnapshot}
              title="Take Video Snapshot"
            >
              <Camera size={16} />
            </button>

            <button 
              className="vlc-ctrl-btn hide-small"
              onClick={togglePiP}
              title="Picture in Picture"
            >
              <PictureInPicture2 size={16} />
            </button>

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
