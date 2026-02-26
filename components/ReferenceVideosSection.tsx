// components/ReferenceVideosSection.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';
import type { ReferenceVideoMeta } from '@/lib/youtube';
import FloatingYouTubePlayer from '@/components/FloatingYouTubePlayer';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ReferenceVideosSection({
  title = 'Reference Videos',
  urls,
  metaMap,
  activeUrl,
  onPlay,
  onClose,
}: {
  title?: string;
  urls: string[];
  metaMap?: Record<string, ReferenceVideoMeta | undefined>;
  activeUrl: string | null;
  onPlay: (url: string) => void;
  onClose: () => void;
}) {
  const cleanUrls = useMemo(() => urls.filter(Boolean).slice(0, 3), [urls]);

  if (cleanUrls.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="videocam-outline" size={14} color={C.textMuted} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{cleanUrls.length}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {cleanUrls.map((url, idx) => {
          const meta = metaMap?.[url];
          const displayTitle = meta?.title || 'Reference Video';
          const displayChannel = meta?.channel || 'YouTube';
          const thumb = meta?.thumbnailUrl || '';

          const expanded = activeUrl === url;

          return (
            <View key={`${url}-${idx}`} style={styles.cardWrap}>
              <Pressable
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  if (expanded) onClose();
                  else onPlay(url);
                }}
              >
                <View style={styles.left}>
                  <View style={styles.thumbWrap}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]} />
                    )}
                    <View style={styles.playBadge}>
                      <Ionicons name="play" size={12} color={C.bg} />
                    </View>
                  </View>

                  <View style={styles.meta}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{displayTitle}</Text>
                    <Text style={styles.videoChannel} numberOfLines={1}>{displayChannel}</Text>
                  </View>
                </View>

                <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={16} color={C.textMuted} />
              </Pressable>

              {expanded && (
                <View style={styles.playerWrap}>
                  <FloatingYouTubePlayer url={url} />
                  <Pressable
                    style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.9 }]}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      onClose();
                    }}
                  >
                    <Ionicons name="close" size={16} color={C.textSecondary} />
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  countPill: {
    minWidth: 26, height: 22, borderRadius: 11,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  countText: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: C.textSecondary },

  list: { gap: 10 },

  cardWrap: { gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface2, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },

  thumbWrap: { width: 54, height: 40, borderRadius: 10, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { backgroundColor: C.surface3 },

  playBadge: {
    position: 'absolute', left: 6, bottom: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },

  meta: { flex: 1, gap: 2 },
  videoTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.text },
  videoChannel: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },

  playerWrap: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
  },
  closeText: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textSecondary },
});