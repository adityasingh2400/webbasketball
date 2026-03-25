import { useEffect, useRef, useState, useCallback } from 'react';

export type WebcamState = {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  stream: MediaStream | null;
};

export type WebcamConfig = {
  width?: number;
  height?: number;
  frameRate?: number;
  facingMode?: 'user' | 'environment';
};

const DEFAULT_CONFIG: Required<WebcamConfig> = {
  width: 1280,
  height: 720,
  frameRate: 30,
  facingMode: 'user',
};

export function useWebcam(config: WebcamConfig = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<WebcamState>({
    isLoading: false,
    isReady: false,
    error: null,
    stream: null,
  });

  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const startWebcam = useCallback(async (videoElement: HTMLVideoElement) => {
    if (streamRef.current) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    videoRef.current = videoElement;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: fullConfig.width },
          height: { ideal: fullConfig.height },
          frameRate: { ideal: fullConfig.frameRate },
          facingMode: fullConfig.facingMode,
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      videoElement.srcObject = stream;
      
      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          resolve();
        };
      });

      setState({
        isLoading: false,
        isReady: true,
        error: null,
        stream,
      });
    } catch (err) {
      let errorMessage = 'Failed to access webcam';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another application.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not support required resolution.';
        } else {
          errorMessage = err.message;
        }
      }

      setState({
        isLoading: false,
        isReady: false,
        error: errorMessage,
        stream: null,
      });
    }
  }, [fullConfig.width, fullConfig.height, fullConfig.frameRate, fullConfig.facingMode]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState({
      isLoading: false,
      isReady: false,
      error: null,
      stream: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    state,
    startWebcam,
    stopWebcam,
  };
}
