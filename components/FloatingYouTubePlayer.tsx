import React from 'react';
import { Platform } from 'react-native';

type Props = {
  videoId: string | null;
  title?: string | null;
  onClose: () => void;
};

export default function FloatingYouTubePlayer(props: Props) {
  // Important: require lazily so web never imports the native youtube lib.
  const Impl =
    Platform.OS === 'web'
      ? require('./FloatingYouTubePlayer.web').default
      : require('./FloatingYouTubePlayer.native').default;

  return <Impl {...props} />;
}