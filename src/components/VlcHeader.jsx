import React from 'react';
import ankaSign from '../assets/anka-sign.png';
import ankaText from '../assets/anka-logo.png';
import { List } from 'lucide-react';

export default function VlcHeader({
  onTogglePlaylist,
  isPlaylistOpen,
  channelCount
}) {
  return (
    <header className="vlc-header">
      {/* Sleek Pure Black Titlebar */}
      <div className="vlc-titlebar">
        <div className="vlc-brand">
          <img src={ankaSign} alt="ANKA Sign" className="anka-sign-logo" />
          <img src={ankaText} alt="ANKA TV" className="anka-text-logo" />
        </div>

        {/* Right Action: Playlist Toggle */}
        <div className="vlc-top-actions">
          <button 
            className={`vlc-quick-btn icon-only ${isPlaylistOpen ? 'active' : ''}`}
            onClick={onTogglePlaylist}
            title="Toggle Channels Playlist (L)"
            aria-label="Toggle Channels Playlist"
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
    </header>
  );
}
