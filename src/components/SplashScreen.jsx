import React, { useState, useEffect } from 'react';
import ankaSign from '../assets/anka-sign.png';
import ankaText from '../assets/anka-logo.png';

export default function SplashScreen({ onComplete }) {
  const [shouldRender, setShouldRender] = useState(true);
  const [fadeExit, setFadeExit] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 1400; // 1.4s smooth progress fill

    let animId;
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);

      if (pct < 100) {
        animId = requestAnimationFrame(updateProgress);
      } else {
        // Hold at 100% briefly, then fade out and show TV UI
        setTimeout(() => {
          setFadeExit(true);
          setTimeout(() => {
            setShouldRender(false);
            if (onComplete) onComplete();
          }, 450);
        }, 220);
      }
    };

    animId = requestAnimationFrame(updateProgress);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [onComplete]);

  if (!shouldRender) return null;

  return (
    <div className={`anka-splash-screen ${fadeExit ? 'fade-out' : ''}`}>
      <div className="anka-splash-content">
        {/* Sign Logo on Left + Text Logo on Right */}
        <div className="anka-splash-logo-wrap">
          <img src={ankaSign} alt="ANKA Sign" className="anka-splash-sign" />
          <img src={ankaText} alt="ANKA TV" className="anka-splash-text" />
        </div>

        {/* White Color Strip Loading Progressbar below the logo ANKA */}
        <div className="anka-progress-track">
          <div 
            className="anka-progress-strip" 
            style={{ width: `${progress}%` }} 
          />
        </div>

        <span className="anka-splash-status">
          {progress >= 100 ? 'Ready' : 'Connecting stream...'}
        </span>
      </div>
    </div>
  );
}
