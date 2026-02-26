import React from "react";
import { View } from "react-native";
import { C } from "@/constants/colors";

/**
 * Routing is handled in app/_layout.tsx (RootLayoutNav).
 * Keep index as a harmless placeholder to avoid double-routing.
 */
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}