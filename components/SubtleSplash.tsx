import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "@/constants/colors";

/**
 * A very minimal branded splash screen shown while the JS bundle is loading.
 *  • background is a dark gradient (using expo-linear-gradient)
 *  • logo pulses gently (scale animation) – no spinning, no text
 *  • intended to sit on top of the native splash for a smoother handoff
 */
export default function SubtleSplash() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.98,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scale]);

  return (
    <LinearGradient colors={[C.bg, "#000000"]} style={styles.container}>
      <Animated.Image
        source={require("../assets/images/icon.png")}
        style={[styles.logo, { transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 100,
    height: 100,
  },
});
