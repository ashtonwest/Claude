import { useEffect, useRef, useState, useCallback } from 'react';
import { ConnectionStatus, WindowInfo, WSIncomingMessage, WSOutgoingMessage } from '../types';

const DEFAULT_PORT = 8080;

interface UseWebSocketReturn {
  status: ConnectionStatus;
  currentFrame: string | null;
  fps: number;
  windows: WindowInfo[];
  selectWindow: (id: string) => void;
  sendKeystroke: (key: string) => void;
  disconnect: () => void;
}

export function useWebSocket(ip: string): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);

  useEffect(() => {
    const url = `ws://${ip}:${DEFAULT_PORT}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.binaryType = 'blob';

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const msg: WSIncomingMessage = JSON.parse(event.data);
          if (msg.type === 'windows') {
            setWindows(msg.windows);
          }
        } catch {
          // ignore malformed JSON
        }
      } else {
        // Binary frame data — convert Blob to base64 data URI
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setCurrentFrame(reader.result);
            frameCountRef.current++;
          }
        };
        reader.readAsDataURL(event.data as Blob);
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      if (status !== 'error') {
        setStatus('idle');
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [ip]);

  // FPS counter — sample every second
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const send = useCallback((msg: WSOutgoingMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const selectWindow = useCallback((id: string) => {
    send({ type: 'select_window', windowId: id });
  }, [send]);

  const sendKeystroke = useCallback((key: string) => {
    send({ type: 'keystroke', key });
  }, [send]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('idle');
  }, []);

  return { status, currentFrame, fps, windows, selectWindow, sendKeystroke, disconnect };
}
