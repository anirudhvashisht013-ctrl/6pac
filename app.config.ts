import type { ConfigContext, ExpoConfig } from "expo/config";

function readEnv(name: string): string {
  return (process.env[name] || "").trim();
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = readEnv("APP_ENV") || readEnv("EAS_BUILD_PROFILE") || readEnv("NODE_ENV") || "development";

  return {
    ...config,
    name: "6Pac",
    slug: "6pac",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "sixpac",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A0F",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.sixpac.app",
    },
    android: {
      package: "com.sixpac.app",
      adaptiveIcon: {
        backgroundColor: "#0A0A0F",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
    },
    web: {
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      [
        "expo-router",
        {
          origin: "https://replit.com/",
        },
      ],
      "expo-font",
      "expo-notifications",
      "expo-web-browser",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appEnv,
      eas: {
        projectId: "c892268c-4c24-4c12-9ee4-1a4085d7c876",
      },
      firebase: {
        apiKey: readEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
        authDomain: readEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
        projectId: readEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
        storageBucket: readEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
        messagingSenderId: readEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
        appId: readEnv("EXPO_PUBLIC_FIREBASE_APP_ID"),
        measurementId: readEnv("EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID") || undefined,
      },
    },
  };
};
