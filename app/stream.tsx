import { useState, useCallback } from 'react';
import { View, Image, Pressable, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAutoHide } from '../hooks/useAutoHide';
import { StreamOverlay } from '../components/StreamOverlay';
import { ControlBar } from '../components/ControlBar';
import { WindowSwitcher } from '../components/WindowSwitcher';
import { KeystrokePanel } from '../components/KeystrokePanel';
import { DisconnectDialog } from '../components/DisconnectDialog';

export default function StreamScreen() {
  const { ip } = useLocalSearchParams<{ ip: string }>();
  const router = useRouter();
  const {
    currentFrame,
    fps,
    windows,
    selectWindow,
    sendKeystroke,
    disconnect,
  } = useWebSocket(ip ?? '');

  const { visible: overlaysVisible, onInteraction } = useAutoHide();
  const [windowPanelVisible, setWindowPanelVisible] = useState(false);
  const [keystrokePanelVisible, setKeystrokePanelVisible] = useState(false);
  const [disconnectVisible, setDisconnectVisible] = useState(false);

  const handleTap = useCallback(() => {
    if (windowPanelVisible || keystrokePanelVisible) return;
    onInteraction();
  }, [onInteraction, windowPanelVisible, keystrokePanelVisible]);

  const handleLongPress = useCallback(() => {
    if (windowPanelVisible || keystrokePanelVisible) return;
    setDisconnectVisible(true);
  }, [windowPanelVisible, keystrokePanelVisible]);

  const toggleWindowPanel = useCallback(() => {
    setKeystrokePanelVisible(false);
    setWindowPanelVisible((prev) => !prev);
  }, []);

  const toggleKeystrokePanel = useCallback(() => {
    setWindowPanelVisible(false);
    setKeystrokePanelVisible((prev) => !prev);
  }, []);

  const handleSelectWindow = useCallback((id: string) => {
    selectWindow(id);
    setWindowPanelVisible(false);
  }, [selectWindow]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    router.back();
  }, [disconnect, router]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {currentFrame && (
        <Image
          source={{ uri: currentFrame }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      )}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleTap}
        onLongPress={handleLongPress}
        delayLongPress={500}
      >
        <StreamOverlay
          visible={overlaysVisible}
          fps={fps}
          hostIp={ip ?? ''}
        />
        <ControlBar
          visible={overlaysVisible}
          onWindowsPress={toggleWindowPanel}
          onKeyboardPress={toggleKeystrokePanel}
        />
      </Pressable>

      <WindowSwitcher
        visible={windowPanelVisible}
        windows={windows}
        onSelectWindow={handleSelectWindow}
        onClose={() => setWindowPanelVisible(false)}
      />

      <KeystrokePanel
        visible={keystrokePanelVisible}
        onSend={sendKeystroke}
        onClose={() => setKeystrokePanelVisible(false)}
      />

      <DisconnectDialog
        visible={disconnectVisible}
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
