import React, { useState, useEffect, useRef } from 'react';
import VlcHeader from './components/VlcHeader';
import VlcPlayer from './components/VlcPlayer';
import ChannelSidebar from './components/ChannelSidebar';
import NetworkStreamModal from './components/NetworkStreamModal';
import MediaInfoModal from './components/MediaInfoModal';
import MobileBottomBar from './components/MobileBottomBar';
import { fetchPlaylistFromUrl, DEFAULT_IPTV_URL, DEMO_CHANNELS } from './utils/m3uParser';
import { Tv, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [channels, setChannels] = useState(DEMO_CHANNELS);
  const [currentChannel, setCurrentChannel] = useState(DEMO_CHANNELS[0]);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(true);
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('default');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const videoRef = useRef(null);

  // Auto-close sidebar on small screens initially if needed
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

  // Load the default IPTV playlist on first launch
  useEffect(() => {
    let isCancelled = false;

    async function loadDefaultPlaylist() {
      setInitialLoading(true);
      try {
        const result = await fetchPlaylistFromUrl(DEFAULT_IPTV_URL);
        if (!isCancelled && result.channels && result.channels.length > 0) {
          setChannels(result.channels);
          setCurrentChannel(result.channels[0]);
          showToast(`Loaded ${result.channels.length.toLocaleString()} channels from IPTV-Org!`, 'success');
        }
      } catch (err) {
        console.warn('Could not load full index.m3u on startup, falling back to verified channels:', err);
      } finally {
        if (!isCancelled) {
          setInitialLoading(false);
        }
      }
    }

    loadDefaultPlaylist();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Keyboard Shortcuts (Standard VLC Keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsStreamModalOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsInfoModalOpen(true);
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play();
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
            document.exitFullscreen();
          } else {
            const playerElem = document.querySelector('.vlc-player-container');
            if (playerElem) playerElem.requestFullscreen();
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

  // Load URL stream or M3U playlist
  const handleLoadUrl = async (url, customName = '') => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchPlaylistFromUrl(url);

      if (result.channels && result.channels.length > 0) {
        setChannels(result.channels);
        setCurrentChannel(result.channels[0]);
        setIsStreamModalOpen(false);
        showToast(
          `Loaded ${result.channels.length.toLocaleString()} channel${result.channels.length > 1 ? 's' : ''}!`,
          'success'
        );
        if (window.innerWidth < 768) {
          setIsPlaylistOpen(true);
        }
      } else {
        setError('No valid streaming channels found in this playlist.');
      }
    } catch (err) {
      console.error('Error fetching playlist:', err);
      setError(err.message || 'Failed to load network stream. Check the URL and CORS headers.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadChannels = (newChannels, sourceName = 'Uploaded Playlist') => {
    if (newChannels && newChannels.length > 0) {
      setChannels(newChannels);
      setCurrentChannel(newChannels[0]);
      showToast(`Loaded ${newChannels.length.toLocaleString()} channels from ${sourceName}`, 'success');
      if (window.innerWidth < 768) {
        setIsPlaylistOpen(true);
      }
    }
  };

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
      link.download = `vlc-snapshot-${currentChannel?.name?.replace(/[^a-z0-9]/gi, '_') || 'stream'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Video snapshot saved!', 'success');
    } catch {
      showToast('Snapshot blocked by stream host CORS policy', 'error');
    }
  };

  return (
    <div className="vlc-app-root">
      {/* VLC Header & Menus */}
      <VlcHeader 
        onOpenStreamModal={() => setIsStreamModalOpen(true)}
        onOpenSampleModal={() => setIsStreamModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onTogglePlaylist={() => setIsPlaylistOpen(prev => !prev)}
        isPlaylistOpen={isPlaylistOpen}
        isPlaying={!videoRef.current?.paused}
        onPlayPause={() => {
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play();
            else videoRef.current.pause();
          }
        }}
        onStop={() => {
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
        }}
        onNextChannel={handleNextChannel}
        onPrevChannel={handlePrevChannel}
        channelCount={channels.length}
        currentChannel={currentChannel}
        onTakeSnapshot={handleTakeSnapshot}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        aspectRatio={aspectRatio}
        onChangeAspectRatio={setAspectRatio}
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
          />
        </div>

        <ChannelSidebar 
          channels={channels}
          currentChannel={currentChannel}
          onSelectChannel={handleSelectChannel}
          isOpen={isPlaylistOpen}
          onClose={() => setIsPlaylistOpen(false)}
          onClearPlaylist={handleClearPlaylist}
          onOpenStreamModal={() => setIsStreamModalOpen(true)}
        />
      </main>

      {/* Mobile Responsive Bottom App Bar */}
      <MobileBottomBar 
        onTogglePlaylist={() => setIsPlaylistOpen(prev => !prev)}
        isPlaylistOpen={isPlaylistOpen}
        onOpenStreamModal={() => setIsStreamModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onNextChannel={handleNextChannel}
        onTakeSnapshot={handleTakeSnapshot}
        channelCount={channels.length}
      />

      {/* Modals */}
      <NetworkStreamModal 
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
        onLoadUrl={handleLoadUrl}
        onLoadChannels={handleLoadChannels}
        isLoading={isLoading}
        error={error}
      />

      <MediaInfoModal 
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        channel={currentChannel}
        videoRef={videoRef}
        aspectRatio={aspectRatio}
        playbackSpeed={playbackSpeed}
      />

      {/* Initial Global Index Loading Indicator */}
      {initialLoading && (
        <div className="vlc-toast info">
          <Loader2 size={16} className="animate-spin text-orange" />
          <span>Connecting to IPTV-Org index ({DEFAULT_IPTV_URL})...</span>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`vlc-toast ${toast.type}`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-green" />
          ) : toast.type === 'error' ? (
            <AlertCircle size={16} className="text-red" />
          ) : (
            <Tv size={16} className="text-orange" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
