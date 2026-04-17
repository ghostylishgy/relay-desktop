import { useState, useMemo, useEffect } from 'react';
import './styles.css';

interface BrowserResultProps {
  result: string;
  toolName: string;
}

interface ParsedContent {
  type: 'text' | 'image' | 'mixed';
  text?: string;
  images: string[];
  urls: string[];
}

function parseResult(result: string): ParsedContent {
  const images: string[] = [];
  const urls: string[] = [];

  // Check for base64 images (data:image/...)
  const base64Regex = /data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+/g;
  const base64Matches = result.match(base64Regex);
  if (base64Matches) {
    images.push(...base64Matches);
  }

  // Check for image URLs
  const imageUrlRegex = /https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)/gi;
  const urlMatches = result.match(imageUrlRegex);
  if (urlMatches) {
    images.push(...urlMatches);
  }

  // Check for general URLs
  const urlRegex = /https?:\/\/[^\s\])"'>]+/g;
  const allUrls = result.match(urlRegex);
  if (allUrls) {
    urls.push(...allUrls.filter(url => !images.includes(url)));
  }

  // Remove image data from text for cleaner display
  let cleanText = result;
  for (const img of images) {
    // Truncate base64 in text display
    if (img.startsWith('data:')) {
      cleanText = cleanText.replace(img, '[base64 image]');
    }
  }

  if (images.length > 0 && cleanText.replace(/\[base64 image\]/g, '').trim().length > 0) {
    return { type: 'mixed', text: cleanText, images, urls };
  } else if (images.length > 0) {
    return { type: 'image', images, urls };
  } else {
    return { type: 'text', text: cleanText, images: [], urls };
  }
}

export function BrowserResult({ result, toolName }: BrowserResultProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [imageZoom, setImageZoom] = useState(1);

  const parsed = useMemo(() => parseResult(result), [result]);

  const isScreenshot = toolName.includes('screenshot') || toolName.includes('vision');
  const isBrowserTool = toolName.includes('browser') || toolName.includes('web');

  // If it's a screenshot tool and has base64, show image prominently
  const showImageFirst = isScreenshot && parsed.images.length > 0;

  // ESC to close fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedImage !== null) {
        setSelectedImage(null);
        setImageZoom(1);
      }
    };
    if (selectedImage !== null) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [selectedImage]);

  const handleImageClick = (index: number) => {
    if (selectedImage === index) {
      setSelectedImage(null);
      setImageZoom(1);
    } else {
      setSelectedImage(index);
      setImageZoom(1);
    }
  };

  const handleZoom = (delta: number) => {
    setImageZoom(prev => Math.max(0.25, Math.min(3, prev + delta)));
  };

  if (parsed.type === 'text' && !isBrowserTool) {
    return (
      <pre className="browser-result-text">{result}</pre>
    );
  }

  return (
    <div className="browser-result">
      {/* Images */}
      {parsed.images.length > 0 && (
        <div className={`browser-result-images ${showImageFirst ? 'prominent' : ''}`}>
          {parsed.images.map((img, index) => (
            <div
              key={index}
              className={`browser-result-image-wrapper ${selectedImage === index ? 'selected' : ''}`}
            >
              <img
                src={img}
                alt={`Screenshot ${index + 1}`}
                className="browser-result-image"
                onClick={() => handleImageClick(index)}
                style={{
                  transform: selectedImage === index ? `scale(${imageZoom})` : undefined,
                  cursor: selectedImage === index ? 'zoom-in' : 'pointer',
                }}
              />
              {selectedImage === index && (
                <div className="browser-result-image-controls">
                  <button onClick={() => handleZoom(-0.25)} title="缩小">−</button>
                  <span>{Math.round(imageZoom * 100)}%</span>
                  <button onClick={() => handleZoom(0.25)} title="放大">+</button>
                  <button onClick={() => { setSelectedImage(null); setImageZoom(1); }} title="关闭">×</button>
                </div>
              )}
            </div>
          ))}
          <div className="browser-result-image-count">
            {parsed.images.length} 张图片
          </div>
        </div>
      )}

      {/* Text content */}
      {parsed.text && parsed.text.trim().length > 0 && (
        <div className="browser-result-text-section">
          <div className="browser-result-section-label">页面内容</div>
          <pre className="browser-result-text">{parsed.text}</pre>
        </div>
      )}

      {/* URLs */}
      {parsed.urls.length > 0 && (
        <div className="browser-result-urls">
          <div className="browser-result-section-label">链接</div>
          {parsed.urls.map((url, index) => (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="browser-result-url"
            >
              {url.length > 60 ? url.slice(0, 57) + '...' : url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
