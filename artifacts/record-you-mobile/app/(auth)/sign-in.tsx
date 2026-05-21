import { useSignIn } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GOLD = "#FDB827";
const BG = "#080808";
const CARD = "#111111";
const INPUT_BG = "#1a1a1a";
const BORDER = "#333333";
const MUTED = "#888888";
const WHITE = "#f8f8f8";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Sign in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>🎙</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to Record You</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={MUTED}
            secureTextEntry
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.btn, (!email || !password || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!email || !password || loading}
        >
          {loading ? (
            <ActivityIndicator color={BG} />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up">
            <Text style={styles.link}>Sign up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  logo: { fontSize: 48, textAlign: "center", marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "700", color: WHITE, textAlign: "center", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 15, color: MUTED, textAlign: "center", marginTop: 6, marginBottom: 28, fontFamily: "Inter_400Regular" },
  card: { backgroundColor: CARD, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontFamily: "Inter_600SemiBold" },
  input: { backgroundColor: INPUT_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER, color: WHITE, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular" },
  error: { color: "#ef4444", fontSize: 13, marginBottom: 12, textAlign: "center", fontFamily: "Inter_400Regular" },
  btn: { backgroundColor: GOLD, borderRadius: 10, height: 50, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: BG, fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { color: MUTED, fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { color: GOLD, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
