import { useAuth } from "@clerk/expo";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Globe, LayoutGrid, List, Mic, Music2, Users } from "lucide-react-native";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "waveform", selected: "waveform" }} />
        <Label>Library</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="studio">
        <Icon sf={{ default: "mic", selected: "mic.fill" }} />
        <Label>Studio</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sessions">
        <Icon sf={{ default: "person.2.wave.2", selected: "person.2.wave.2.fill" }} />
        <Label>Sessions</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="community">
        <Icon sf={{ default: "person.3", selected: "person.3.fill" }} />
        <Label>Community</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tuner">
        <Icon sf={{ default: "tuningfork", selected: "tuningfork" }} />
        <Label>Tuner</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tools">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Tools</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const safeAreaInsets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: safeAreaInsets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Library",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="waveform" tintColor={color} size={24} />
            ) : (
              <List size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "Studio",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="mic.fill" tintColor={color} size={24} />
            ) : (
              <Mic size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: "Sessions",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2.wave.2" tintColor={color} size={24} />
            ) : (
              <Globe size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.3" tintColor={color} size={24} />
            ) : (
              <Users size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tuner"
        options={{
          title: "Tuner",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="tuningfork" tintColor={color} size={24} />
            ) : (
              <Music2 size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.grid.2x2" tintColor={color} size={24} />
            ) : (
              <LayoutGrid size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="metronome"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
