import React from 'react';
import { 
  Tv, 
  List, 
  Globe, 
  SkipForward, 
  Info, 
  Camera,
  Sparkles
} from 'lucide-react';

export default function MobileBottomBar({
  onTogglePlaylist,
  isPlaylistOpen,
  onOpenStreamModal,
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
      >
        <div className="mobile-tab-icon-wrap">
          <List size={20} />
          {channelCount > 0 && <span className="mobile-tab-badge">{channelCount > 999 ? '999+' : channelCount}</span>}
        </div>
        <span>Channels</span>
      </button>

      <button 
        className="mobile-tab-btn primary-action"
        onClick={onOpenStreamModal}
      >
        <div className="mobile-tab-icon-wrap action-bubble">
          <Globe size={22} />
        </div>
        <span>Open Stream</span>
      </button>

      <button 
        className="mobile-tab-btn"
        onClick={onNextChannel}
      >
        <div className="mobile-tab-icon-wrap">
          <SkipForward size={20} />
        </div>
        <span>Next</span>
      </button>

      <button 
        className="mobile-tab-btn"
        onClick={onTakeSnapshot}
      >
        <div className="mobile-tab-icon-wrap">
          <Camera size={20} />
        </div>
        <span>Snapshot</span>
      </button>

      <button 
        className="mobile-tab-btn"
        onClick={onOpenInfoModal}
      >
        <div className="mobile-tab-icon-wrap">
          <Info size={20} />
        </div>
        <span>Stream Info</span>
      </button>
    </div>
  );
}
