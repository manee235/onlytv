import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Tv, 
  Star, 
  X, 
  Trash2, 
  Globe, 
  ChevronDown
} from 'lucide-react';

export default function ChannelSidebar({
  channels = [],
  currentChannel,
  onSelectChannel,
  isOpen,
  onClose,
  onClearPlaylist,
  onOpenStreamModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(80);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('vlc_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reset pagination when search or category filter changes
  useEffect(() => {
    setVisibleCount(80);
  }, [searchQuery, selectedGroup]);

  const toggleFavorite = (channelId, e) => {
    e.stopPropagation();
    setFavorites(prev => {
      let updated;
      if (prev.includes(channelId)) {
        updated = prev.filter(id => id !== channelId);
      } else {
        updated = [...prev, channelId];
      }
      try {
        localStorage.setItem('vlc_favorites', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save favorites:', err);
      }
      return updated;
    });
  };

  // Extract unique categories (top 35 categories to prevent overflow)
  const groups = useMemo(() => {
    const groupCountMap = new Map();
    channels.forEach(ch => {
      if (ch.group) {
        groupCountMap.set(ch.group, (groupCountMap.get(ch.group) || 0) + 1);
      }
    });
    return Array.from(groupCountMap.entries())
      .sort((a, b) => b[1] - a[1]) // most popular categories first
      .slice(0, 30)
      .map(([name]) => name);
  }, [channels]);

  // Filter channels based on search and selected category
  const filteredChannels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return channels.filter(ch => {
      const matchesSearch = !query || 
        ch.name.toLowerCase().includes(query) ||
        (ch.group && ch.group.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      if (selectedGroup === 'ALL') return true;
      if (selectedGroup === 'FAVORITES') return favorites.includes(ch.id);
      return ch.group === selectedGroup;
    });
  }, [channels, searchQuery, selectedGroup, favorites]);

  // Render sliced subset for peak performance
  const displayedChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount);
  }, [filteredChannels, visibleCount]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      if (visibleCount < filteredChannels.length) {
        setVisibleCount(prev => prev + 60);
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && <div className="vlc-sidebar-backdrop" onClick={onClose} />}

      <aside className={`vlc-channel-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <h3>Playlist Channels</h3>
            <span className="channel-badge">{channels.length.toLocaleString()}</span>
          </div>
          <div className="sidebar-header-actions">
            {channels.length > 0 && (
              <button 
                className="icon-btn-danger" 
                onClick={onClearPlaylist}
                title="Clear Playlist"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button 
              className="icon-btn close-btn" 
              onClick={onClose}
              title="Close Panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="sidebar-search-box">
          <Search size={16} className="search-icon" />
          <input 
            type="text"
            placeholder="Search channels, genres, languages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Group / Category Pills */}
        <div className="sidebar-categories">
          <button 
            className={`cat-pill ${selectedGroup === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedGroup('ALL')}
          >
            All ({channels.length.toLocaleString()})
          </button>

          <button 
            className={`cat-pill fav ${selectedGroup === 'FAVORITES' ? 'active' : ''}`}
            onClick={() => setSelectedGroup('FAVORITES')}
          >
            <Star size={12} fill={selectedGroup === 'FAVORITES' ? '#f59e0b' : 'none'} />
            Favorites ({favorites.length})
          </button>

          {groups.map(group => {
            return (
              <button 
                key={group}
                className={`cat-pill ${selectedGroup === group ? 'active' : ''}`}
                onClick={() => setSelectedGroup(group)}
              >
                {group}
              </button>
            );
          })}
        </div>

        {/* Channel List with High Performance Infinite Scroll */}
        <div className="sidebar-channel-list" onScroll={handleScroll}>
          {displayedChannels.length > 0 ? (
            <>
              {displayedChannels.map((ch, idx) => {
                const isSelected = currentChannel && currentChannel.id === ch.id;
                const isFav = favorites.includes(ch.id);

                return (
                  <div 
                    key={ch.id || idx}
                    className={`channel-item ${isSelected ? 'active' : ''}`}
                    onClick={() => onSelectChannel(ch)}
                  >
                    <div className="channel-index">
                      {isSelected ? (
                        <div className="equalizer-bars">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    <div className="channel-logo-wrapper">
                      {ch.logo ? (
                        <img 
                          src={ch.logo} 
                          alt={ch.name} 
                          loading="lazy"
                          className="channel-thumb"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div 
                        className="channel-thumb-fallback"
                        style={{ display: ch.logo ? 'none' : 'flex' }}
                      >
                        <Tv size={14} />
                      </div>
                    </div>

                    <div className="channel-info-box">
                      <div className="channel-name" title={ch.name}>
                        {ch.name}
                      </div>
                      <div className="channel-tags">
                        <span className="tag-group">{ch.group || 'General'}</span>
                        {ch.quality && <span className="tag-quality">{ch.quality}</span>}
                      </div>
                    </div>

                    <button 
                      className={`fav-btn ${isFav ? 'active' : ''}`}
                      onClick={(e) => toggleFavorite(ch.id, e)}
                      title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Star 
                        size={15} 
                        fill={isFav ? "#f59e0b" : "none"} 
                        stroke={isFav ? "#f59e0b" : "currentColor"} 
                      />
                    </button>
                  </div>
                );
              })}

              {visibleCount < filteredChannels.length && (
                <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                  <button 
                    className="vlc-btn secondary"
                    style={{ fontSize: '0.78rem', width: '100%', justifyContent: 'center' }}
                    onClick={() => setVisibleCount(prev => prev + 100)}
                  >
                    <ChevronDown size={14} />
                    Load More Channels ({filteredChannels.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="sidebar-empty">
              {channels.length === 0 ? (
                <div className="empty-prompt">
                  <Tv size={36} className="text-muted" />
                  <h4>No Channels Loaded</h4>
                  <p>Insert an M3U stream URL or choose from curated channels.</p>
                  <button className="vlc-btn primary" onClick={onOpenStreamModal}>
                    <Globe size={15} /> Load Playlist
                  </button>
                </div>
              ) : (
                <div className="empty-prompt">
                  <Search size={32} className="text-muted" />
                  <h4>No Matching Channels</h4>
                  <p>Try searching with another keyword or select "All".</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
