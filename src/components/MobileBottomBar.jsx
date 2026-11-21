import React from 'react';
import { 
  List, 
  SkipForward, 
  Info, 
  Camera 
} from 'lucide-react';

export default function MobileBottomBar({
  onTogglePlaylist,
  isPlaylistOpen,
  onOpenInfoModal,
  onNextChannel,
  onTakeSnapshot,
  channelCount
}) {
  return (
    <div className="onlytv-mobile-appbar">
      <button 
        className={`mobile-tab-btn ${isPlaylistOpen ? 'active' : ''}`}
        onClick={onTogglePlaylist}
        aria-label="Channels"
      >
        <div className="mobile-tab-icon-wrap">
          <List size={20} />
          {channelCount > 0 && <span className="mobile-tab-badge">{channelCount > 999 ? '999+' : channelCount}</span>}
        </div>
        <span>Channels</span>
      </button>

      <button 
        className="mobile-tab-btn"
        onClick={onNextChannel}
        aria-label="Next Channel"
      >
        <div className="mobile-tab-icon-wrap">
          <SkipForward size={20} />
        </div>
        <span>Next</span>
      </button>

      <button 
        className="mobile-tab-btn"
        onClick={onTakeSnapshot}
        aria-label="Take Video Snapshot"
      >
        <div className="mobile-tab-icon-wrap">
          <Camera size={20} />
        </div>
        <span>Snapshot</span>
      </button>

      <button 
        className="mobile-tab-btn"
        onClick={onOpenInfoModal}
        aria-label="Stream Info"
      >
        <div className="mobile-tab-icon-wrap">
          <Info size={20} />
        </div>
        <span>Stream Info</span>
      </button>
    </div>
  );
}
