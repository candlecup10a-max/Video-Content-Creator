/**
 * Audio extraction utility using the Web Audio API.
 * Decodes the audio track from uploaded video and audio files into a compact,
 * high-fidelity 16,000 Hz mono 16-bit PCM WAV file for Gemini speech transcription.
 */

export interface ExtractedAudioResult {
  audioBase64?: string;
  mimeType: string;
  duration: number;
  hasAudioTrack: boolean;
  isSilent: boolean;
  format: 'wav' | 'native' | 'none';
  rmsEnergy: number;
  error?: string;
}

/**
 * Extracts and downsamples the audio track from a video or audio File.
 */
export async function extractAudioFromMedia(file: File): Promise<ExtractedAudioResult> {
  if (typeof window === 'undefined') {
    return {
      mimeType: 'none',
      duration: 0,
      hasAudioTrack: false,
      isSilent: true,
      format: 'none',
      rmsEnergy: 0,
      error: 'Audio extraction requires a browser environment.',
    };
  }

  // 1. Primary path: Web Audio API AudioContext.decodeAudioData
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioCtx) {
      const audioResult = await decodeWithAudioContext(file, AudioCtx);
      if (audioResult) {
        return audioResult;
      }
    }
  } catch (err) {
    console.warn('[AudioExtractor] AudioContext decode failed, trying fallbacks:', err);
  }

  // 2. Secondary fallback: If the file is small (<= 20MB), we can read the raw media file as base64
  if (file.size <= 20 * 1024 * 1024) {
    try {
      const b64 = await readFileAsBase64(file);
      if (b64) {
        return {
          audioBase64: b64,
          mimeType: file.type || 'video/mp4',
          duration: 0,
          hasAudioTrack: true,
          isSilent: false,
          format: 'native',
          rmsEnergy: 0.1,
        };
      }
    } catch (err) {
      console.warn('[AudioExtractor] Fallback to raw base64 failed:', err);
    }
  }

  return {
    mimeType: 'none',
    duration: 0,
    hasAudioTrack: false,
    isSilent: true,
    format: 'none',
    rmsEnergy: 0,
    error: 'Could not extract audio track from this video format.',
  };
}

async function decodeWithAudioContext(
  file: File,
  AudioCtx: typeof AudioContext
): Promise<ExtractedAudioResult | null> {
  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await file.arrayBuffer();
    // decodeAudioData decodes audio from MP4, WebM, MOV, MP3, WAV, etc.
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const numChannels = audioBuffer.numberOfChannels;

    if (numChannels === 0 || duration === 0) {
      return {
        mimeType: 'audio/wav',
        duration: 0,
        hasAudioTrack: false,
        isSilent: true,
        format: 'none',
        rmsEnergy: 0,
      };
    }

    // Measure RMS energy across audio samples
    const channel0 = audioBuffer.getChannelData(0);
    let sumSquares = 0;
    const sampleStep = Math.max(1, Math.floor(channel0.length / 8000));
    let sampledCount = 0;

    for (let i = 0; i < channel0.length; i += sampleStep) {
      sumSquares += channel0[i] * channel0[i];
      sampledCount++;
    }

    const rmsEnergy = sampledCount > 0 ? Math.sqrt(sumSquares / sampledCount) : 0;
    const isSilent = rmsEnergy < 0.0005;

    // Convert audio buffer to 16,000 Hz 16-bit mono WAV
    const targetSampleRate = 16000;
    const wavBlob = encodeAudioBufferToWav(audioBuffer, targetSampleRate);
    const audioBase64 = await blobToBase64(wavBlob);

    return {
      audioBase64,
      mimeType: 'audio/wav',
      duration: Math.round(duration * 10) / 10,
      hasAudioTrack: true,
      isSilent,
      format: 'wav',
      rmsEnergy: Math.round(rmsEnergy * 1000) / 1000,
    };
  } finally {
    if (ctx.state !== 'closed') {
      try {
        await ctx.close();
      } catch {
        // Ignore audio context close error
      }
    }
  }
}

/**
 * Resamples an AudioBuffer to targetSampleRate, converts to mono, and encodes as a 16-bit PCM WAV.
 */
function encodeAudioBufferToWav(audioBuffer: AudioBuffer, targetSampleRate: number): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const originalLength = audioBuffer.length;
  const originalSampleRate = audioBuffer.sampleRate;

  // 1. Downmix to mono Float32Array
  const mono = new Float32Array(originalLength);
  if (numChannels === 1) {
    mono.set(audioBuffer.getChannelData(0));
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < originalLength; i++) {
      mono[i] = (ch0[i] + ch1[i]) * 0.5;
    }
  }

  // 2. Resample if necessary (linear interpolation)
  let outputSamples: Float32Array;
  if (originalSampleRate === targetSampleRate) {
    outputSamples = mono;
  } else {
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(originalLength / ratio);
    outputSamples = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const origIndex = i * ratio;
      const index0 = Math.floor(origIndex);
      const index1 = Math.min(index0 + 1, originalLength - 1);
      const fraction = origIndex - index0;
      outputSamples[i] = mono[index0] * (1 - fraction) + mono[index1] * fraction;
    }
  }

  // 3. Build 44-byte WAV header + 16-bit PCM audio samples
  const bytesPerSample = 2; // 16-bit
  const dataByteLength = outputSamples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // ChunkSize
  writeAscii(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = mono)
  view.setUint32(24, targetSampleRate, true); // SampleRate
  view.setUint32(28, targetSampleRate * bytesPerSample, true); // ByteRate
  view.setUint16(32, bytesPerSample, true); // BlockAlign (1 * 2)
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" sub-chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataByteLength, true); // Subchunk2Size

  // Write 16-bit PCM samples with clipping protection
  let offset = 44;
  for (const rawSample of outputSamples) {
    const sample = Math.max(-1, Math.min(1, rawSample));
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, Math.round(int16), true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIdx = dataUrl.indexOf(',');
      resolve(commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : dataUrl);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

export function readFileAsBase64(file: File): Promise<string> {
  return blobToBase64(file);
}
