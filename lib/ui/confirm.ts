import { Alert, Platform } from "react-native";

export async function confirm(options: {
  title: string;
  message: string;
  okText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const {
    title,
    message,
    okText = "OK",
    cancelText = "Cancel",
    destructive = false,
  } = options;

  // Web: use native confirm
  if (Platform.OS === "web") {
    return window.confirm(`${title}\n\n${message}`);
  }

  // Native: use Alert.alert
  return await new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      {
        text: okText,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}