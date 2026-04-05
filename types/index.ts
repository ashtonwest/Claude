export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface WindowInfo {
  id: string;
  title: string;
  isActive: boolean;
}

export type WSIncomingMessage =
  | { type: 'windows'; windows: WindowInfo[] }
  | { type: 'error'; message: string };

export type WSOutgoingMessage =
  | { type: 'select_window'; windowId: string }
  | { type: 'keystroke'; key: string };
