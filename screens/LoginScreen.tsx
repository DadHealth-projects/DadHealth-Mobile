import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import {
  biometricLogin,
  getBiometricLabel,
  hasBiometricCredentials,
  isBiometricAvailable,
} from '../lib/biometric';
import { isAppleAuthAvailable, signInWithApple, signInWithGoogle } from '../lib/oauth';
import { colors } from '../theme';
import { useNavigation } from '@react-navigation/native';

type LoadingKind =
  | 'in'
  | 'bio'
  | 'apple'
  | 'google'
  | 'signup'
  | 'reset';

/**
 * A provider / biometric sign-in button. Shares one outline style so Face ID,
 * Apple and Google read as one group above the email form.
 */
function AuthProviderButton({
  icon,
  label,
  onPress,
  disabled,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center justify-center gap-sm bg-muted/40 border border-border rounded-button px-lg py-md active:opacity-70 disabled:opacity-60"
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          {icon}
          <Text className="font-heading-semibold text-white text-[14px] tracking-[0.5px] uppercase">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function LoginScreen() {
  const {
  signIn,
  signUp,
  resetPassword,
  pendingBiometricEnrollment,
} = useAuth();
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState<null | LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [bioLabel, setBioLabel] = useState('Face ID');
  const [bioEnabled, setBioEnabled] = useState(false);
  const [appleEnabled, setAppleEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const [available, hasCreds, label, apple] = await Promise.all([
        isBiometricAvailable(),
        hasBiometricCredentials(),
        getBiometricLabel(),
        isAppleAuthAvailable(),
      ]);

      if (!active) return;

      setBioEnabled(available && hasCreds);
      setBioLabel(label);
      setAppleEnabled(apple);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Clear previous messages as soon as the user edits the form.
  useEffect(() => {
  if (error) setError(null);
  if (info) setInfo(null);
}, [email, password]);

  const validate = (): boolean => {
    if (!email.trim()) {
      setError('Enter your email.');
      return false;
    }

    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return false;
    }

    if (!password.trim()) {
      setError('Enter your password.');
      return false;
    }

    return true;
  };


  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading('in');
    setError(null);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (
          error.toLowerCase().includes('invalid login') ||
          error.toLowerCase().includes('invalid_credentials') ||
          error.toLowerCase().includes('invalid credentials')
        ) {
          setError('Incorrect email or password.');
        } else {
          setError(error);
        }

        return;
      }

      // No biometric prompt? Close the Login screen and let auth state drive navigation.
      if (!pendingBiometricEnrollment) {
        navigation.goBack();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleBiometric = async () => {
    setLoading('bio');
    setError(null);

    try {
      const result = await biometricLogin();

      if (!result.success) {
        setError(result.error ?? 'Biometric login failed.');
        return;
      }

      navigation.goBack();
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setLoading('apple');
    setError(null);

    try {
      const { error } = await signInWithApple();

      if (error) {
        setError(error);
        return;
      }

      navigation.goBack();
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    setError(null);

    try {
      const { error } = await signInWithGoogle();

      if (error) {
        setError(error);
        return;
      }

      navigation.goBack();
    } finally {
      setLoading(null);
    }
  };

  const handleForgotPassword = async () => {
  if (!email.trim() || !email.includes('@')) {
    setError('Enter your email to reset your password.');
    return;
  }

  setError(null);
  setInfo(null);
  setLoading('reset');

  try {
    const { error: err } = await resetPassword(email);

    if (err) {
      setError(err);
      return;
    }

    setInfo('Password reset link sent. Check your email.');
  } finally {
    setLoading(null);
  }
};

  const handleCreateAccount = async () => {
  if (!validate()) return;

  setError(null);
  setInfo(null);
  setLoading('signup');

  try {
    const { error: err } = await signUp(email, password);

    if (err) {
      setError(err);
      return;
    }

    setInfo('Account created. Check your email to confirm, then sign in.');
  } finally {
    setLoading(null);
  }
};

  const busy = loading !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="grow justify-center px-lg py-xl"
        >
          {/* Close (X) — dismisses the modal, returning to where it was opened. */}
          <View className="flex-row justify-end mb-lg">
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={8}
              className="h-[40px] w-[40px] rounded-full border border-border items-center justify-center"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Header */}
          <View className="mb-xl">
            <View className="flex-row items-center gap-sm mb-sm">
              <View className="h-[18px] w-[4px] rounded-full bg-lime" />

              <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
                Welcome Back
              </Text>
            </View>

            <Text className="font-heading text-white text-[46px] leading-[48px] uppercase">
              Dad Health
            </Text>

            <Text className="font-body text-muted-text text-[15px] leading-[24px] mt-md">
              Continue your health journey.
            </Text>
          </View>

          {/* Continue with — biometric + social providers */}
          <View className="gap-md">
            {bioEnabled && (
              <AuthProviderButton
                icon={<Feather name="unlock" size={18} color={colors.text} />}
                label={`Continue with ${bioLabel}`}
                onPress={handleBiometric}
                disabled={busy}
                loading={loading === 'bio'}
              />
            )}

            {appleEnabled && (
              <AuthProviderButton
                icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
                label="Continue with Apple"
                onPress={handleApple}
                disabled={busy}
                loading={loading === 'apple'}
              />
            )}

            <AuthProviderButton
              icon={<Ionicons name="logo-google" size={18} color={colors.text} />}
              label="Continue with Google"
              onPress={handleGoogle}
              disabled={busy}
              loading={loading === 'google'}
            />
          </View>

          {/* OR divider */}
          <View className="flex-row items-center gap-md my-xl">
            <View className="flex-1 h-[1px] bg-border" />
            <Text className="font-heading-semibold text-muted-text text-[12px] tracking-label uppercase">
              Or
            </Text>
            <View className="flex-1 h-[1px] bg-border" />
          </View>

          {/* Email */}
          <Text className="font-heading-semibold text-muted-text text-[12px] tracking-label uppercase mb-sm">
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!busy}
            className="bg-muted/40 border border-border rounded-button px-md py-md text-white text-[16px] font-body focus:border-lime mb-md"
          />

          {/* Password */}
          <Text className="font-heading-semibold text-muted-text text-[12px] tracking-label uppercase mb-sm">
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.tertiaryText}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            editable={!busy}
            className="bg-muted/40 border border-border rounded-button px-md py-md text-white text-[16px] font-body focus:border-lime"
          />

          {/* Forgot Password */}
          <View className="flex-row justify-end mt-sm">
            <Pressable onPress={handleForgotPassword} disabled={busy} hitSlop={8}>
              <Text className="font-heading-semibold text-lime text-[12px] tracking-[0.5px] uppercase">
                Forgot Password?
              </Text>
            </Pressable>
          </View>

          {/* Error / info */}
          {error && (
            <Text className="font-body text-[#F87171] text-[14px] leading-[20px] mt-md">
              {error}
            </Text>
          )}

          {!error && info && (
            <Text className="font-body text-lime text-[14px] leading-[20px] mt-md">
              {info}
            </Text>
          )}

          {/* Sign In */}
          <Pressable
            onPress={handleSignIn}
            disabled={busy}
            className="bg-lime rounded-button px-lg py-md items-center justify-center mt-xl active:bg-lime-hover active:opacity-90 disabled:opacity-60"
          >
            {loading === 'in' ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase">
                Sign In
              </Text>
            )}
          </Pressable>

          {/* Create Account */}
          <View className="flex-row items-center justify-center gap-sm mt-lg">
            <Text className="font-body text-muted-text text-[14px]">New here?</Text>
            <Pressable onPress={handleCreateAccount} disabled={busy} hitSlop={8}>
              {loading === 'signup' ? (
                <ActivityIndicator color={colors.lime} />
              ) : (
                <Text className="font-heading-semibold text-lime text-[14px] tracking-[0.5px] uppercase">
                  Create Account
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
