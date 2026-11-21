import React, { useState, useEffect, useRef } from 'react';
import VlcHeader from './components/VlcHeader';
import VlcPlayer from './components/VlcPlayer';
import ChannelSidebar from './components/ChannelSidebar';
import MediaInfoModal from './components/MediaInfoModal';
import VlcEffectsModal from './components/VlcEffectsModal';
import MobileBottomBar from './components/MobileBottomBar';
import SplashScreen from './components/SplashScreen';
import { fetchPlaylistFromUrl, DEFAULT_IPTV_URL, DEMO_CHANNELS } from './utils/m3uParser';
import { Tv, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [channels, setChannels] = useState(DEMO_CHANNELS);
  const [currentChannel, setCurrentChannel] = useState(DEMO_CHANNELS[0]);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(true);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isEffectsModalOpen, setIsEffectsModalOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('default');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [cachingMode, setCachingMode] = useState('low'); // Default to ultra-low latency (300ms)
  const [videoEffects, setVideoEffects] = useState({
    brightness: 1,
    contrast: 1,
    saturate: 1,
    hue: 0
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const videoRef = useRef(null);

  // Auto-close sidebar on small screens initially for better video view
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsPlaylistOpen(false);
    }
  }, []);

  // Show temporary toast message
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Automatically fetch and load default stream/playlist on startup without any popup
  useEffect(() => {
    let isCancelled = false;

    async function autoLoadDefaultStream() {
      setInitialLoading(true);
      try {
        const result = await fetchPlaylistFromUrl(DEFAULT_IPTV_URL);
        if (!isCancelled && result.channels && result.channels.length > 0) {
          setChannels(result.channels);
          setCurrentChannel(result.channels[0]);
          showToast(`Stream Ready: ${result.channels.length.toLocaleString()} channels connected`, 'success');
        }
      } catch (err) {
        console.warn('Startup index stream fetch fallback:', err);
      } finally {
        if (!isCancelled) {
          setInitialLoading(false);
        }
      }
    }

    autoLoadDefaultStream();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Standard VLC Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsInfoModalOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsEffectsModalOpen(true);
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play().catch(() => {});
            else videoRef.current.pause();
          }
          break;
        case 's':
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            showToast('Playback stopped');
          }
          break;
        case 'n':
          handleNextChannel();
          break;
        case 'p':
          handlePrevChannel();
          break;
        case 'l':
          setIsPlaylistOpen(prev => !prev);
          break;
        case 'f':
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            const playerElem = document.querySelector('.vlc-player-container');
            if (playerElem) playerElem.requestFullscreen().catch(() => {});
          }
          break;
        case 'm':
          if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            showToast(videoRef.current.muted ? 'Muted' : 'Unmuted');
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, currentChannel]);

  const handleSelectChannel = (channel) => {
    setCurrentChannel(channel);
    showToast(`Playing: ${channel.name}`);
    if (window.innerWidth < 768) {
      setIsPlaylistOpen(false);
    }
  };

  const handleNextChannel = () => {
    if (!channels || channels.length === 0) return;
    const currentIndex = channels.findIndex(c => c.id === currentChannel?.id);
    const nextIndex = (currentIndex + 1) % channels.length;
    setCurrentChannel(channels[nextIndex]);
    showToast(`Next: ${channels[nextIndex].name}`);
  };

  const handlePrevChannel = () => {
    if (!channels || channels.length === 0) return;
    const currentIndex = channels.findIndex(c => c.id === currentChannel?.id);
    const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
    setCurrentChannel(channels[prevIndex]);
    showToast(`Prev: ${channels[prevIndex].name}`);
  };

  const handleClearPlaylist = () => {
    if (window.confirm('Clear all channels from the current playlist?')) {
      setChannels([]);
      setCurrentChannel(null);
      showToast('Playlist cleared');
    }
  };

  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      showToast('No active video to capture snapshot from', 'error');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const link = document.createElement('a');
      link.download = `anka-snapshot-${currentChannel?.name?.replace(/[^a-z0-9]/gi, '_') || 'stream'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Video snapshot saved!', 'success');
    } catch {
      showToast('Snapshot blocked by stream host CORS policy', 'error');
    }
  };

  const handleChangeEffects = (prop, val) => {
    setVideoEffects(prev => ({ ...prev, [prop]: val }));
  };

  const handleResetEffects = () => {
    setVideoEffects({
      brightness: 1,
      contrast: 1,
      saturate: 1,
      hue: 0
    });
    showToast('Video effects reset to defaults');
  };

  const handleChangeCachingMode = (mode) => {
    setCachingMode(mode);
    const labels = { low: 'Lowest Latency (300ms)', normal: 'Normal Caching (1000ms)', high: 'High Caching (3000ms)' };
    showToast(`VLC Network Buffer set to: ${labels[mode]}`);
  };

  return (
    <div className="vlc-app-root">
      {/* ANKA Loading Splash Screen with White Progressbar */}
      <SplashScreen />

      {/* Sleek ANKA Header */}
      <VlcHeader 
        onTogglePlaylist={() => setIsPlaylistOpen(prev => !prev)}
        isPlaylistOpen={isPlaylistOpen}
        channelCount={channels.length}
      />

      {/* Main Workspace Layout */}
      <main className="vlc-main-workspace">
        <div className="vlc-stage-area">
          <VlcPlayer 
            channel={currentChannel}
            onNextChannel={handleNextChannel}
            onPrevChannel={handlePrevChannel}
            onTogglePlaylist={() => setIsPlaylistOpen(prev => !prev)}
            isPlaylistOpen={isPlaylistOpen}
            aspectRatio={aspectRatio}
            onChangeAspectRatio={setAspectRatio}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
            onTakeSnapshot={handleTakeSnapshot}
            videoRef={videoRef}
            videoEffects={videoEffects}
            cachingMode={cachingMode}
            onChangeCachingMode={setCachingMode}
            onOpenEffectsModal={() => setIsEffectsModalOpen(true)}
          />
        </div>

        <ChannelSidebar 
          channels={channels}
          currentChannel={currentChannel}
          onSelectChannel={handleSelectChannel}
          isOpen={isPlaylistOpen}
          onClose={() => setIsPlaylistOpen(false)}
          onClearPlaylist={handleClearPlaylist}
        />
      </main>

      {/* Mobile Responsive Bottom App Bar */}
      <MobileBottomBar 
        onTogglePlaylist={() => setIsPlaylistOpen(prev => !prev)}
        isPlaylistOpen={isPlaylistOpen}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onNextChannel={handleNextChannel}
        onTakeSnapshot={handleTakeSnapshot}
        channelCount={channels.length}
      />

      {/* Auxiliary Modals (Opened via shortcuts or menus) */}
      <MediaInfoModal 
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        channel={currentChannel}
        videoRef={videoRef}
        aspectRatio={aspectRatio}
        playbackSpeed={playbackSpeed}
      />

      <VlcEffectsModal 
        isOpen={isEffectsModalOpen}
        onClose={() => setIsEffectsModalOpen(false)}
        videoEffects={videoEffects}
        onChangeEffects={handleChangeEffects}
        onResetEffects={handleResetEffects}
        cachingMode={cachingMode}
        onChangeCachingMode={handleChangeCachingMode}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`vlc-toast ${toast.type}`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-green" />
          ) : toast.type === 'error' ? (
            <AlertCircle size={16} className="text-red" />
          ) : (
            <Tv size={16} className="text-blue" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
