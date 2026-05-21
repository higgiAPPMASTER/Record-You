import { Stack } from "expo-router";
import React from "react";

import { useColors } from "@/hooks/useColors";

export default function ToolsLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="mixer" options={{ title: "Mixer" }} />
      <Stack.Screen name="metronome" options={{ title: "Metronome" }} />
      <Stack.Screen name="capo" options={{ title: "Capo Calculator" }} />
      <Stack.Screen name="tabs" options={{ title: "Tabs" }} />
    </Stack>
  );
}
