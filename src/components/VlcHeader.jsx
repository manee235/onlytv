import React, { useState, useRef, useEffect } from 'react';
import appLogo from '../assets/Cyan Blue Winged Play Logo.png';
import { 
  Tv, 
  Play, 
  Square, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Maximize, 
  List, 
  Sliders, 
  Info, 
  FolderOpen, 
  Globe, 
  Sparkles,
  Camera,
  ChevronDown
} from 'lucide-react';

export default function VlcHeader({
  onOpenStreamModal,
  onOpenSampleModal,
  onOpenInfoModal,
  onTogglePlaylist,
  isPlaylistOpen,
  isPlaying,
  onPlayPause,
  onStop,
  onNextChannel,
  onPrevChannel,
  channelCount,
  currentChannel,
  onTakeSnapshot,
  playbackSpeed,
  onChangeSpeed,
  aspectRatio,
  onChangeAspectRatio
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const closeMenu = () => setActiveMenu(null);

  return (
    <header className="vlc-header" ref={menuRef}>
      {/* Top Titlebar */}
      <div className="vlc-titlebar">
        <div className="vlc-brand">
          <img src={appLogo} alt="OnlyTV Logo" className="onlytv-brand-logo" />
          <span className="vlc-title">OnlyTV</span>
          <span className="vlc-badge hide-mobile">Live Stream</span>
        </div>

        {/* Quick Top Actions */}
        <div className="vlc-top-actions">
          <button 
            className="vlc-quick-btn primary"
            onClick={onOpenStreamModal}
            title="Open Network Stream or M3U Playlist (Ctrl+N)"
          >
            <Globe size={15} />
            <span className="hide-mobile">Open Network Stream</span>
            <span className="show-mobile-only">Stream</span>
          </button>

          <button 
            className="vlc-quick-btn secondary hide-mobile"
            onClick={onOpenSampleModal}
            title="Explore Free IPTV Channels"
          >
            <Sparkles size={15} className="text-blue" />
            <span>Curated</span>
          </button>

          <button 
            className={`vlc-quick-btn icon-only ${isPlaylistOpen ? 'active' : ''}`}
            onClick={onTogglePlaylist}
            title="Toggle Playlist Channels (L)"
          >
            <List size={18} />
            {channelCount > 0 && (
              <span className="channel-pill">
                {channelCount > 999 ? '999+' : channelCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Classic VLC / Desktop Menu Bar */}
      <nav className="vlc-menubar hide-mobile">
        {/* Media Menu */}
        <div className="vlc-menu-item">
          <button 
            className={`vlc-menu-trigger ${activeMenu === 'media' ? 'active' : ''}`}
            onClick={() => toggleMenu('media')}
          >
            Media <ChevronDown size={12} />
          </button>
          {activeMenu === 'media' && (
            <div className="vlc-dropdown-menu">
              <button onClick={() => { onOpenStreamModal(); closeMenu(); }}>
                <Globe size={14} /> Open Network Stream... <span className="shortcut">Ctrl+N</span>
              </button>
              <button onClick={() => { onOpenSampleModal(); closeMenu(); }}>
                <Sparkles size={14} /> Browse Curated IPTV Playlists...
              </button>
              <div className="divider"></div>
              <button onClick={() => { onTakeSnapshot(); closeMenu(); }}>
                <Camera size={14} /> Take Video Snapshot
              </button>
              <button onClick={() => { onOpenInfoModal(); closeMenu(); }}>
                <Info size={14} /> Media Information... <span className="shortcut">Ctrl+I</span>
              </button>
            </div>
          )}
        </div>

        {/* Playback Menu */}
        <div className="vlc-menu-item">
          <button 
            className={`vlc-menu-trigger ${activeMenu === 'playback' ? 'active' : ''}`}
            onClick={() => toggleMenu('playback')}
          >
            Playback <ChevronDown size={12} />
          </button>
          {activeMenu === 'playback' && (
            <div className="vlc-dropdown-menu">
              <button onClick={() => { onPlayPause(); closeMenu(); }}>
                <Play size={14} /> {isPlaying ? 'Pause' : 'Play'} <span className="shortcut">Space</span>
              </button>
              <button onClick={() => { onStop(); closeMenu(); }}>
                <Square size={14} /> Stop <span className="shortcut">S</span>
              </button>
              <div className="divider"></div>
              <button onClick={() => { onPrevChannel(); closeMenu(); }}>
                <SkipBack size={14} /> Previous Channel <span className="shortcut">P</span>
              </button>
              <button onClick={() => { onNextChannel(); closeMenu(); }}>
                <SkipForward size={14} /> Next Channel <span className="shortcut">N</span>
              </button>
              <div className="divider"></div>
              <div className="menu-submenu-header">Playback Speed</div>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(speed => (
                <button 
                  key={speed} 
                  className={playbackSpeed === speed ? 'selected' : ''}
                  onClick={() => { onChangeSpeed(speed); closeMenu(); }}
                >
                  <span>{speed}x {speed === 1.0 ? '(Normal)' : ''}</span>
                  {playbackSpeed === speed && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Video Menu */}
        <div className="vlc-menu-item">
          <button 
            className={`vlc-menu-trigger ${activeMenu === 'video' ? 'active' : ''}`}
            onClick={() => toggleMenu('video')}
          >
            Video <ChevronDown size={12} />
          </button>
          {activeMenu === 'video' && (
            <div className="vlc-dropdown-menu">
              <div className="menu-submenu-header">Aspect Ratio</div>
              {[
                { label: 'Auto / Default', val: 'default' },
                { label: '16:9 Widescreen', val: '16:9' },
                { label: '4:3 Standard TV', val: '4:3' },
                { label: 'Fill / Crop (Cover)', val: 'cover' },
                { label: 'Stretch to Window', val: 'fill' }
              ].map(opt => (
                <button 
                  key={opt.val}
                  className={aspectRatio === opt.val ? 'selected' : ''}
                  onClick={() => { onChangeAspectRatio(opt.val); closeMenu(); }}
                >
                  <span>{opt.label}</span>
                  {aspectRatio === opt.val && <span>✓</span>}
                </button>
              ))}
              <div className="divider"></div>
              <button onClick={() => { onTakeSnapshot(); closeMenu(); }}>
                <Camera size={14} /> Snapshot Screen
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="vlc-menu-item">
          <button 
            className={`vlc-menu-trigger ${activeMenu === 'view' ? 'active' : ''}`}
            onClick={() => toggleMenu('view')}
          >
            View <ChevronDown size={12} />
          </button>
          {activeMenu === 'view' && (
            <div className="vlc-dropdown-menu">
              <button onClick={() => { onTogglePlaylist(); closeMenu(); }}>
                <List size={14} /> {isPlaylistOpen ? 'Hide Playlist' : 'Show Playlist'} <span className="shortcut">L</span>
              </button>
              <button onClick={() => { onOpenInfoModal(); closeMenu(); }}>
                <Info size={14} /> Stream Inspector
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
