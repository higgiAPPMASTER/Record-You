import { Globe, Music, Play, Pause, Users, Clock, Lock } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useListCommunityPosts } from "@workspace/api-client-react";

type Post = {
  id: number;
  songId: number;
  userId: string;
  displayName: string | null;
  note: string | null;
  visibility: string;
  listenToken: string | null;
  title: string;
  hasAudio: boolean;
  duration: number | null;
  audioUrl: string | null;
  createdAt: string;
};

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: posts = [], isLoading, refetch, isRefetching } = useListCommunityPosts();
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const filtered = (posts as Post[]).filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.displayName ?? "").toLowerCase().includes(q) ||
      (p.note ?? "").toLowerCase().includes(q)
    );
  });

  const handlePlay = async (id: number, audioUrl: string | null | undefined) => {
    if (!audioUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (playingId === id) {
      await soundRef.current?.pauseAsync();
      setPlayingId(null);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    setLoadingId(id);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingId(id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch {
      setPlayingId(null);
    } finally {
      setLoadingId(null);
    }
  };

  const handleListenLink = (token: string | null) => {
    if (!token) return;
    const domain = process.env.EXPO_PUBLIC_API_URL ?? "";
    Linking.openURL(`${domain}/listen/${token}`);
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isPlaying = playingId === item.id;
    const isLoadingThis = loadingId === item.id;

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardRow}>
          {/* Play button */}
          <Pressable
            style={[
              styles.playBtn,
              { backgroundColor: isPlaying ? colors.primary : colors.muted },
            ]}
            onPress={() => handlePlay(item.id, item.audioUrl)}
            disabled={!item.hasAudio || isLoadingThis}
          >
            {isLoadingThis ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isPlaying ? (
              <Pause size={16} color={colors.primaryForeground} />
            ) : (
              <Play size={16} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
            )}
          </Pressable>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[
                styles.badge,
                { backgroundColor: item.visibility === "public" ? colors.primary + "22" : colors.muted }
              ]}>
                {item.visibility === "public"
                  ? <Globe size={10} color={colors.primary} />
                  : <Lock size={10} color={colors.mutedForeground} />}
                <Text style={[
                  styles.badgeText,
                  { color: item.visibility === "public" ? colors.primary : colors.mutedForeground }
                ]}>
                  {item.visibility === "public" ? "Public" : "Friends"}
                </Text>
              </View>
            </View>

            {item.note ? (
              <Text style={[styles.note, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.note}
              </Text>
            ) : null}

            <View style={styles.meta}>
              {item.displayName ? (
                <Text style={[styles.metaText, { color: colors.foreground, opacity: 0.7 }]}>
                  {item.displayName}
                </Text>
              ) : null}
              {item.duration ? (
                <View style={styles.metaItem}>
                  <Clock size={10} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {formatDuration(item.duration)}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {timeAgo(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitle}>
          <Users size={20} color={colors.primary} />
          <Text style={[styles.headerText, { color: colors.foreground }]}>Community</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Recordings shared by musicians
        </Text>

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search by title, name, or note…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Music size={48} color={colors.mutedForeground + "40"} />
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
            {search ? `No results for "${search}"` : "Nothing shared yet"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            {search ? "" : "Share a recording from the web app to get started."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  headerText: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 13, marginBottom: 12 },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  searchInput: { fontSize: 14 },
  list: { padding: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", opacity: 0.7 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" },
  title: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  note: { fontSize: 12, marginBottom: 4, lineHeight: 16 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11 },
});
