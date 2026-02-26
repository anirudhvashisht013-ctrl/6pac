// components/FloatingYouTubePlayer.web.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
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

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`;

  return (
    <View style={[styles.wrap, { height }]}>
      {/* @ts-ignore - iframe is fine on web */}
      <iframe
        src={embedUrl}
        style={styles.iframe as any}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
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
  iframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
});