// components/FloatingYouTubePlayer.native.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { C } from '@/constants/colors';
import { extractYouTubeId } from '@/lib/youtube';

export default function FloatingYouTubePlayer({
  url,
  height = 210,
}: {
  url: string;
  height?: number;
}) {
  const videoId = extractYouTubeId(url);

  if (!videoId) return null;

  return (
    <View style={[styles.wrap, { height }]}>
      <YoutubePlayer
        height={height}
        play
        videoId={videoId}
        webViewStyle={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
  },
  webview: {
    backgroundColor: C.surface2,
  },
});