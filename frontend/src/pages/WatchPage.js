import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Alert, Spinner } from 'react-bootstrap';
import { ArrowLeft, BoxArrowUpRight } from 'react-bootstrap-icons';
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

    const videoData = extractVideoInfo(src);
    setVideoInfo(videoData);
    setLoading(false);
  }, [src]);

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

  if (loading) {
    return (
      <Container className="watch-page-container">
        <Row className="justify-content-center">
          <Col md={8}>
            <div className="text-center p-5">
              <Spinner animation="border" />
              <p className="mt-3">Loading video...</p>
            </div>
          </Col>
        </Row>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="watch-page-container">
        <Row className="justify-content-center">
          <Col md={8}>
            <Card className="error-card">
              <Card.Body className="text-center">
                <Alert variant="danger">
                  <h4>⚠️ Error</h4>
                  <p>{error}</p>
                </Alert>
                <Button variant="outline-primary" onClick={() => navigate(-1)}>
                  <ArrowLeft /> Go Back
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container className="watch-page-container">
      <Row className="justify-content-center">
        <Col lg={10}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <Button variant="outline-secondary" onClick={() => navigate(-1)} className="back-button">
              <ArrowLeft /> Back
            </Button>
            <h1 className="video-title">{title}</h1>
            {videoInfo?.originalUrl && (
              <Button variant="outline-primary" onClick={() => window.open(videoInfo.originalUrl, '_blank')} className="original-link-button">
                <BoxArrowUpRight /> Open Original
              </Button>
            )}
          </div>

          <Card className="video-card">
            <Card.Body className="p-0">
              <div className="video-container">
                {videoInfo?.type === 'youtube' && (
                  <iframe
                    src={videoInfo.embedUrl}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                
                {videoInfo?.type === 'vimeo' && (
                  <iframe
                    src={videoInfo.embedUrl}
                    title="Vimeo video player"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                )}
                
                {videoInfo?.type === 'direct' && (
                  <video
                    controls
                    crossOrigin="anonymous"
                  >
                    <source src={videoInfo.url} type="video/mp4" />
                    <source src={videoInfo.url} type="video/webm" />
                    Your browser doesn't support HTML5 video.
                  </video>
                )}
              </div>
            </Card.Body>
          </Card>

          <Card className="mt-4">
            <Card.Body>
              <h5>Video Information</h5>
              <p><strong>Type:</strong> {videoInfo?.type === 'youtube' ? 'YouTube Video' : 
                                        videoInfo?.type === 'vimeo' ? 'Vimeo Video' : 'Direct Video File'}</p>
              <p><strong>Source:</strong> <a href={videoInfo?.originalUrl} target="_blank" rel="noopener noreferrer">
                {videoInfo?.originalUrl}
              </a></p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default WatchPage; 
