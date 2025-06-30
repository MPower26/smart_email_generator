import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, VolumeUp, VolumeMute, Fullscreen, Settings } from 'react-bootstrap-icons';
import './WatchPage.css';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function WatchPage() {
  const query = useQuery();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoRef, setVideoRef] = useState(null);

  const src = query.get('src');
  const title = query.get('title') || 'Video';

  useEffect(() => {
    if (!src) {
      setError('No video URL provided.');
      setLoading(false);
      return;
    }

    if (!src.startsWith('https://')) {
      setError('Invalid video URL. Only HTTPS URLs are allowed.');
      setLoading(false);
      return;
    }

    // Fetch user information
    fetchUserInfo();
    
    const videoData = extractVideoInfo(src);
    setVideoInfo(videoData);
    setLoading(false);
  }, [src]);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUserInfo(userData);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const extractVideoInfo = (url) => {
    // YouTube detection
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return {
        type: 'youtube',
        videoId: videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        originalUrl: url
      };
    }

    // Vimeo detection
    const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      return {
        type: 'vimeo',
        videoId: videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
        originalUrl: url
      };
    }

    // Direct video file
    return {
      type: 'direct',
      url: url,
      originalUrl: url
    };
  };

  const togglePlay = () => {
    if (videoRef) {
      if (isPlaying) {
        videoRef.pause();
      } else {
        videoRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef) {
      videoRef.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.requestFullscreen();
      }
    }
  };

  const handleVideoClick = () => {
    togglePlay();
  };

  const handleMouseMove = () => {
    setShowControls(true);
    setTimeout(() => setShowControls(false), 3000);
  };

  if (loading) {
    return (
      <div className="watch-page-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your video experience...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="watch-page-container">
        <div className="error-container">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h2>Error</h2>
            <p>{error}</p>
            <button className="back-button" onClick={() => navigate(-1)}>
              <ArrowLeft /> Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="watch-page-container" onMouseMove={handleMouseMove}>
      {/* Header */}
      <div className="video-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </button>
        <div className="company-info">
          {userInfo?.company_name && (
            <span className="company-name">{userInfo.company_name}</span>
          )}
        </div>
        <div className="video-title">{title}</div>
      </div>

      {/* Video Player */}
      <div className="video-player-container">
        <div className="video-wrapper">
          {videoInfo?.type === 'youtube' && (
            <iframe
              src={videoInfo.embedUrl}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="video-element"
            />
          )}
          
          {videoInfo?.type === 'vimeo' && (
            <iframe
              src={videoInfo.embedUrl}
              title="Vimeo video player"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="video-element"
            />
          )}
          
          {videoInfo?.type === 'direct' && (
            <video
              ref={setVideoRef}
              controls={false}
              crossOrigin="anonymous"
              className="video-element"
              onClick={handleVideoClick}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={videoInfo.url} type="video/mp4" />
              <source src={videoInfo.url} type="video/webm" />
              Your browser doesn't support HTML5 video.
            </video>
          )}

          {/* Custom Controls Overlay */}
          {videoInfo?.type === 'direct' && (
            <div className={`video-controls ${showControls ? 'show' : ''}`}>
              <div className="controls-background"></div>
              <div className="controls-content">
                <div className="play-button" onClick={togglePlay}>
                  {isPlaying ? <Pause /> : <Play />}
                </div>
                <div className="controls-right">
                  <button className="control-button" onClick={toggleMute}>
                    {isMuted ? <VolumeMute /> : <VolumeUp />}
                  </button>
                  <button className="control-button" onClick={toggleFullscreen}>
                    <Fullscreen />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="video-footer">
        <div className="footer-content">
          <div className="video-info">
            <h3>{title}</h3>
            {userInfo?.company_name && (
              <p className="company-description">
                Presented by {userInfo.company_name}
                {userInfo?.company_description && (
                  <span className="company-desc"> • {userInfo.company_description}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WatchPage; 
