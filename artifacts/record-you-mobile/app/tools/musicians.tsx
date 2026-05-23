import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

type Musician = {
  id: number;
  name: string;
  instrument: string;
  genre: string | null;
  city: string;
  bio: string | null;
  contactEmail: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
};

const INSTRUMENTS = [
  "Guitar", "Bass", "Drums", "Piano / Keys", "Vocals", "Violin",
  "Saxophone", "Trumpet", "Cello", "Mandolin", "Banjo", "Ukulele",
  "Harmonica", "Producer / Beatmaker", "Other",
];

const GENRES = [
  "Rock", "Pop", "Country", "Blues", "Jazz", "Folk", "Metal",
  "Hip-Hop", "R&B", "Classical", "Bluegrass", "Indie", "Electronic", "Other",
];

export default function MusiciansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "", instrument: "", genre: "", city: "", bio: "", contactEmail: "",
  });
  const [pickInstrument, setPickInstrument] = useState(false);
  const [pickGenre, setPickGenre] = useState(false);

  const fetchMusicians = useCallback(async (lat?: number, lng?: number) => {
    try {
      const params = lat != null && lng != null ? `?lat=${lat}&lng=${lng}&radius=200` : "";
      const res = await fetch(`${BASE}/musicians${params}`);
      const data = await res.json();
      setMusicians(data);
    } catch {
      Alert.alert("Error", "Could not load musicians.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setUserLocation(coords);
        fetchMusicians(coords.lat, coords.lng);
      } else {
        fetchMusicians();
      }
    })();
  }, [fetchMusicians]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.instrument.trim() || !form.city.trim()) {
      Alert.alert("Required", "Name, instrument, and city are required.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        instrument: form.instrument.trim(),
        city: form.city.trim(),
      };
      if (form.genre) body.genre = form.genre;
      if (form.bio) body.bio = form.bio.trim();
      if (form.contactEmail) body.contactEmail = form.contactEmail.trim();
      if (userLocation) { body.lat = userLocation.lat; body.lng = userLocation.lng; }

      const res = await fetch(`${BASE}/musicians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      const created = await res.json();
      setMusicians((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ name: "", instrument: "", genre: "", city: "", bio: "", contactEmail: "" });
      Alert.alert("Listed!", "Your profile is now visible to other musicians.");
    } catch {
      Alert.alert("Error", "Could not save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    back: { padding: 4 },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    },
    addBtnText: { color: "#000", fontFamily: "Inter_600SemiBold", fontSize: 13 },
    scroll: { padding: 16, paddingBottom: Math.max(insets.bottom + 120, 200) },
    card: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, padding: 16, marginBottom: 10, gap: 6,
    },
    cardName: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground },
    cardRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    badge: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
      backgroundColor: colors.primary + "25",
    },
    badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary },
    cityBadge: { backgroundColor: colors.muted },
    cityBadgeText: { color: colors.mutedForeground },
    bio: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    email: { fontSize: 12, color: colors.primary, fontFamily: "Inter_500Medium", marginTop: 2 },
    empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15, textAlign: "center" },
    // Form modal
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: insets.bottom + 20, gap: 12, maxHeight: "90%",
    },
    sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 4 },
    label: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground,
      fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: colors.background,
    },
    picker: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    pickerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    pickerPlaceholder: { color: colors.mutedForeground },
    btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    submitBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
    submitBtnText: { color: "#000", fontFamily: "Inter_700Bold", fontSize: 15 },
    cancelBtn: { paddingVertical: 13, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    cancelBtnText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 },
    // Picker modal
    pickerModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    pickerSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, maxHeight: "70%" },
    pickerOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    pickerOptionText: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_500Medium" },
  });

  const PickerModal = ({
    visible, options, onSelect, onClose, title,
  }: { visible: boolean; options: string[]; onSelect: (v: string) => void; onClose: () => void; title: string }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.pickerModal} onPress={onClose}>
        <Pressable style={s.pickerSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={[s.sheetTitle, { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }]}>{title}</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            {options.map((opt) => (
              <Pressable key={opt} style={s.pickerOption} onPress={() => { onSelect(opt); onClose(); }}>
                <Text style={s.pickerOptionText}>{opt}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Musicians Near Me</Text>
        <Pressable style={s.addBtn} onPress={() => setShowForm(true)}>
          <Feather name="plus" size={14} color="#000" />
          <Text style={s.addBtnText}>List Myself</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          {musicians.length === 0 ? (
            <View style={s.empty}>
              <Feather name="users" size={48} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No musicians listed yet.{"\n"}Be the first in your area!</Text>
              <Pressable style={s.addBtn} onPress={() => setShowForm(true)}>
                <Feather name="plus" size={14} color="#000" />
                <Text style={s.addBtnText}>List Myself</Text>
              </Pressable>
            </View>
          ) : (
            musicians.map((m) => (
              <View key={m.id} style={s.card}>
                <Text style={s.cardName}>{m.name}</Text>
                <View style={s.cardRow}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{m.instrument}</Text>
                  </View>
                  {m.genre && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{m.genre}</Text>
                    </View>
                  )}
                  <View style={[s.badge, s.cityBadge]}>
                    <Text style={[s.badgeText, s.cityBadgeText]}>📍 {m.city}</Text>
                  </View>
                </View>
                {m.bio ? <Text style={s.bio}>{m.bio}</Text> : null}
                {m.contactEmail ? <Text style={s.email}>✉ {m.contactEmail}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Create Profile Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={s.overlay} onPress={() => setShowForm(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>List Yourself</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={s.label}>Name *</Text>
                  <TextInput style={s.input} placeholder="Your name" placeholderTextColor={colors.mutedForeground} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
                </View>
                <View>
                  <Text style={s.label}>Instrument *</Text>
                  <Pressable style={s.picker} onPress={() => setPickInstrument(true)}>
                    <Text style={[s.pickerText, !form.instrument && s.pickerPlaceholder]}>{form.instrument || "Select instrument…"}</Text>
                    <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
                <View>
                  <Text style={s.label}>Genre</Text>
                  <Pressable style={s.picker} onPress={() => setPickGenre(true)}>
                    <Text style={[s.pickerText, !form.genre && s.pickerPlaceholder]}>{form.genre || "Select genre…"}</Text>
                    <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
                <View>
                  <Text style={s.label}>City *</Text>
                  <TextInput style={s.input} placeholder="e.g. Pittsburgh, PA" placeholderTextColor={colors.mutedForeground} value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} />
                </View>
                <View>
                  <Text style={s.label}>Bio</Text>
                  <TextInput style={[s.input, { height: 80, textAlignVertical: "top" }]} placeholder="Tell other musicians about yourself…" placeholderTextColor={colors.mutedForeground} multiline value={form.bio} onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))} />
                </View>
                <View>
                  <Text style={s.label}>Contact Email</Text>
                  <TextInput style={s.input} placeholder="Optional — shown on your listing" placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" value={form.contactEmail} onChangeText={(v) => setForm((f) => ({ ...f, contactEmail: v }))} />
                </View>
                {userLocation && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="map-pin" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 12, color: colors.primary, fontFamily: "Inter_500Medium" }}>Location detected — you'll appear on nearby searches</Text>
                  </View>
                )}
                <View style={s.btnRow}>
                  <Pressable style={s.cancelBtn} onPress={() => setShowForm(false)}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
                    <Text style={s.submitBtnText}>{submitting ? "Saving…" : "Post Listing"}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <PickerModal visible={pickInstrument} title="Select Instrument" options={INSTRUMENTS} onSelect={(v) => setForm((f) => ({ ...f, instrument: v }))} onClose={() => setPickInstrument(false)} />
      <PickerModal visible={pickGenre} title="Select Genre" options={GENRES} onSelect={(v) => setForm((f) => ({ ...f, genre: v }))} onClose={() => setPickGenre(false)} />
    </View>
  );
}
