/**
 * Utility for extracting visual keyframes from video files in the browser using HTML5 Video + Canvas.
 * Used for AI visual content analysis of silent videos, B-roll, reels, and action montages.
 */

export interface VideoFrameSample {
  timestampSeconds: number;
  imageBase64: string; // JPEG base64 without data: prefix
  mimeType: 'image/jpeg';
}

export interface VideoVisualExtractionResult {
  frames: VideoFrameSample[];
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  error?: string;
}

/**
 * Samples evenly spaced visual keyframes across a video's duration.
 */
export async function extractVideoKeyframes(
  fileOrUrl: File | string,
  options?: {
    maxFrames?: number;
    maxDimension?: number;
    targetDuration?: number;
  }
): Promise<VideoVisualExtractionResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      frames: [],
      duration: options?.targetDuration || 0,
      width: 0,
      height: 0,
      aspectRatio: '9:16',
      error: 'Browser environment required for visual frame extraction.',
    };
  }

  const maxFrames = Math.max(3, Math.min(8, options?.maxFrames || 5));
  const maxDim = options?.maxDimension || 480;

  const isFile = typeof fileOrUrl !== 'string';
  const videoUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';

  try {
    // 1. Wait for video metadata to load
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error('Video metadata loading timed out.'));
      }, 5000);

      const onLoaded = () => {
        window.clearTimeout(timer);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
        resolve();
      };

      const onError = () => {
        window.clearTimeout(timer);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
        reject(new Error('Video format could not be decoded by browser player.'));
      };

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
      video.src = videoUrl;
      video.load();
    });

    const duration = video.duration && !isNaN(video.duration) && video.duration > 0
      ? video.duration
      : options?.targetDuration || 15;

    const naturalWidth = video.videoWidth || 720;
    const naturalHeight = video.videoHeight || 1280;
    const aspectRatio = naturalHeight > naturalWidth ? '9:16' : '16:9';

    // Calculate canvas size keeping aspect ratio with max dimension
    let targetWidth = naturalWidth;
    let targetHeight = naturalHeight;
    if (naturalWidth > naturalHeight) {
      if (naturalWidth > maxDim) {
        targetWidth = maxDim;
        targetHeight = Math.round((naturalHeight / naturalWidth) * maxDim);
      }
    } else {
      if (naturalHeight > maxDim) {
        targetHeight = maxDim;
        targetWidth = Math.round((naturalWidth / naturalHeight) * maxDim);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(160, targetWidth);
    canvas.height = Math.max(160, targetHeight);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context could not be created.');
    }

    // 2. Determine sample timestamps (spread across 10% to 90% of duration)
    const sampleTimestamps: number[] = [];
    for (let i = 0; i < maxFrames; i++) {
      const fraction = (i + 0.5) / maxFrames;
      const t = Math.max(0.2, Math.min(duration - 0.2, fraction * duration));
      sampleTimestamps.push(Number(t.toFixed(2)));
    }

    const frames: VideoFrameSample[] = [];

    for (const timestamp of sampleTimestamps) {
      try {
        await seekVideoToTime(video, timestamp);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        const base64Only = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

        frames.push({
          timestampSeconds: timestamp,
          imageBase64: base64Only,
          mimeType: 'image/jpeg',
        });
      } catch (seekErr) {
        console.warn(`[VideoExtractor] Could not capture frame at ${timestamp}s:`, seekErr);
      }
    }

    return {
      frames,
      duration: Math.round(duration * 10) / 10,
      width: naturalWidth,
      height: naturalHeight,
      aspectRatio,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Visual frame extraction failed.';
    console.warn('[VideoExtractor] Keyframe extraction warning:', errorMsg);
    return {
      frames: [],
      duration: options?.targetDuration || 0,
      width: 0,
      height: 0,
      aspectRatio: '9:16',
      error: errorMsg,
    };
  } finally {
    if (isFile && videoUrl) {
      try {
        URL.revokeObjectURL(videoUrl);
      } catch {
        // Ignore revoke errors
      }
    }
    video.src = '';
    video.load();
  }
}

/**
 * Seeks a video element to a specific timestamp with a timeout safeguard.
 */
function seekVideoToTime(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;

    const timer = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', onSeeked);
      resolve(); // Proceed anyway if seek takes too long
    }, 1200);

    const onSeeked = () => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };

    video.addEventListener('seeked', onSeeked);
    video.currentTime = seconds;
  });
}
