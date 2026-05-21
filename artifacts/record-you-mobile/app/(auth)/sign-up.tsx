import { useAuth, useSignUp } from "@clerk/expo";
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

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: () => router.replace("/(tabs)"),
      });
    }
  };

  if (isSignedIn) return null;

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>Enter the code we sent to {email}</Text>
        <View style={[styles.card, { marginHorizontal: 24 }]}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            placeholderTextColor={MUTED}
            keyboardType="numeric"
          />
          {errors?.fields?.code && (
            <Text style={styles.error}>{errors.fields.code.message}</Text>
          )}
        </View>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <Pressable
            style={[styles.btn, fetchStatus === "fetching" && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={fetchStatus === "fetching"}
          >
            {fetchStatus === "fetching" ? (
              <ActivityIndicator color={BG} />
            ) : (
              <Text style={styles.btnText}>Verify</Text>
            )}
          </Pressable>
          <Pressable onPress={() => signUp.verifications.sendEmailCode()}>
            <Text style={[styles.link, { textAlign: "center" }]}>Resend code</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start recording your music</Text>

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
          {errors?.fields?.emailAddress && (
            <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
          )}

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Choose a password"
            placeholderTextColor={MUTED}
            secureTextEntry
          />
          {errors?.fields?.password && (
            <Text style={styles.error}>{errors.fields.password.message}</Text>
          )}
        </View>

        <Pressable
          style={[styles.btn, (!email || !password || fetchStatus === "fetching") && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!email || !password || fetchStatus === "fetching"}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={BG} />
          ) : (
            <Text style={styles.btnText}>Create Account</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text style={styles.link}>Sign in</Text>
          </Link>
        </View>

        <View nativeID="clerk-captcha" />
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
  error: { color: "#ef4444", fontSize: 12, marginTop: 6, fontFamily: "Inter_400Regular" },
  btn: { backgroundColor: GOLD, borderRadius: 10, height: 50, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: BG, fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { color: MUTED, fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { color: GOLD, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
