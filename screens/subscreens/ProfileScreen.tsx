import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import AppTopBar from '../../components/AppTopBar';
import Card from '../../components/Card';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { useDashboard } from '../../hooks/useDashboard';
import { useEntitlement } from '../../hooks/useEntitlement';
import { navigateToProSubscription } from '../../lib/proNavigation';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/+$/, '');
const PROFILE_PHOTO_API_URL = `${WEB_BASE_URL}/api/profile/photo`;
const MAX_SOURCE_PHOTO_SIZE = 20 * 1024 * 1024;
const MAX_FUNCTION_UPLOAD_SIZE = 4 * 1024 * 1024;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { session, user } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const { data: dashboardData, loading: dashboardLoading, refresh: refreshDashboard } = useDashboard(user?.id);
  const entitlement = useEntitlement({
    isPro: dashboardData?.isPro ?? null,
    trialActive: dashboardData?.trialActive ?? null,
    loading: dashboardLoading,
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(typeof user?.user_metadata?.dadhealth_avatar_url === 'string' ? user.user_metadata.dadhealth_avatar_url : null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const email = user?.email ?? '0';
  const initial = (user?.email?.[0] ?? '?').toUpperCase();
  // Display-only retention: feature access still comes from canonical entitlement checks.
  const membershipSnapshot = useRef<{
    owner: string | undefined;
    verified: { isPro: boolean; trialActive: boolean } | null;
    retrying: boolean;
  }>({ owner: user?.id, verified: null, retrying: false });
  if (membershipSnapshot.current.owner !== user?.id) {
    membershipSnapshot.current = { owner: user?.id, verified: null, retrying: false };
  }
  if (user?.id && typeof entitlement.isPro === 'boolean') {
    membershipSnapshot.current.verified = {
      isPro: entitlement.isPro,
      trialActive: entitlement.trialActive === true,
    };
  }
  const verifiedMembership = membershipSnapshot.current.verified;
  const membershipAccess = entitlement.can('mind_plan');
  const membershipTitle = verifiedMembership
    ? verifiedMembership.isPro
      ? verifiedMembership.trialActive ? 'Pro Trial' : 'Dad Health Pro'
      : 'Free Plan'
    : dashboardLoading
      ? 'Membership'
      : 'Unable to load membership';
  const membershipDescription = !verifiedMembership ? null
    : verifiedMembership.isPro
      ? verifiedMembership.trialActive ? 'Your trial includes Dad Health Pro access.'
        : 'Your Pro membership and access are active.'
      : 'Get more from your health insights and plans.';
  const retryMembership = useCallback(async () => {
    const scope = membershipSnapshot.current;
    if (!scope.owner || scope.owner !== user?.id || scope.retrying || dashboardLoading) return;
    scope.retrying = true;
    try { await refreshDashboard(); }
    catch { /* Keep the existing card's unknown state; do not infer a connection fault. */ }
    finally { scope.retrying = false; }
  }, [dashboardLoading, refreshDashboard, user?.id]);

  const openMembership = useCallback(() => {
    if (!verifiedMembership) {
      if (!dashboardLoading) void retryMembership();
      return;
    }

    if (membershipAccess === false) {
      navigateToProSubscription(
        navigation,
        'profile_membership',
        'Membership',
        user?.id
      );
      return;
    }

    navigation.navigate('ProSubscription', {
      source: 'profile_membership',
      context: 'Membership',
      feature: 'profile_membership'
    });
  }, [
    verifiedMembership,
    dashboardLoading,
    retryMembership,
    membershipAccess,
    navigation,
    user?.id
  ]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('user_profile').select('avatar_url').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (typeof data?.avatar_url === 'string') setAvatarUrl(data.avatar_url);
    });
  }, [user?.id]);

  const pickPhoto = useCallback(async () => {
    if (!session?.access_token) return;
    if (isOffline) { showOfflineAction('profile_photo'); return; }
    setMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setMessage('Photo access is required to choose a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const selectedAsset = result.assets[0];
    if (typeof selectedAsset.fileSize === 'number' && selectedAsset.fileSize > MAX_SOURCE_PHOTO_SIZE) {
      setMessage('Choose a photo smaller than 20 MB.');
      return;
    }
    setPhotoBusy(true);
    let responseStatus: number | null = null;
    let apiErrorCode: string | null = null;
    try {
      if (typeof selectedAsset.fileSize !== 'number') {
        const sourceResponse = await fetch(selectedAsset.uri);
        if (!sourceResponse.ok) throw new Error('Unable to read selected image');
        const sourceBlob = await sourceResponse.blob();
        if (sourceBlob.size > MAX_SOURCE_PHOTO_SIZE) {
          setMessage('Choose a photo smaller than 20 MB.');
          return;
        }
      }
      const prepared = await ImageManipulator.manipulateAsync(selectedAsset.uri, [{ resize: { width: 800, height: 800 } }], { compress: 0.84, format: ImageManipulator.SaveFormat.JPEG });
      const imageResponse = await fetch(prepared.uri);
      if (!imageResponse.ok) {
        throw new Error('Unable to read prepared image');
      }

      const imageBlob = await imageResponse.blob();
      if (imageBlob.size > MAX_FUNCTION_UPLOAD_SIZE) {
        setMessage('This photo could not be compressed enough to upload. Try another photo.');
        return;
      }

      const form = new FormData();
      form.append('photo', imageBlob, 'profile.jpg');
      const response = await fetch(PROFILE_PHOTO_API_URL, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      responseStatus = response.status;
      const body = await response.json().catch(() => ({}));
      apiErrorCode = typeof body.error === 'string' ? body.error : null;
      if (!response.ok || typeof body.avatar_url !== 'string') throw new Error('upload_failed');
      setAvatarUrl(body.avatar_url);
      await supabase.auth.updateUser({ data: { dadhealth_avatar_url: body.avatar_url } });
      setMessage('Profile photo updated.');
    } catch {
      if (apiErrorCode === 'photo_too_large' || responseStatus === 413) {
        setMessage(responseStatus === 413 && apiErrorCode !== 'photo_too_large'
          ? 'Upload is too large. Try a smaller photo.'
          : 'Choose a photo smaller than 20 MB.');
      } else if (['missing_photo', 'invalid_image', 'unsupported_image_format', 'image_processing_failed'].includes(apiErrorCode ?? '')) {
        setMessage('This photo is not a supported image. Choose a JPEG, PNG or iPhone photo.');
      } else if (responseStatus !== null && responseStatus >= 500) {
        setMessage('The server could not save your photo. Try again shortly.');
      } else {
        setMessage('Upload failed. Check your connection and try again.');
      }
    } finally {
      setPhotoBusy(false);
    }
  }, [isOffline, session?.access_token, showOfflineAction]);

  const removePhoto = useCallback(() => {
    if (!session?.access_token) return;
    Alert.alert('Remove profile photo?', 'Your account will use your initial instead.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void (async () => {
        if (isOffline) { showOfflineAction('profile_photo'); return; }
        setPhotoBusy(true); setMessage(null);
        try {
          const response = await fetch(PROFILE_PHOTO_API_URL, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
          if (!response.ok) throw new Error('remove_failed');
          setAvatarUrl(null);
          await supabase.auth.updateUser({ data: { dadhealth_avatar_url: null } });
          setMessage('Profile photo removed.');
        } catch { setMessage('We could not remove your profile photo. Please try again.'); }
        finally { setPhotoBusy(false); }
      })() },
    ]);
  }, [isOffline, session?.access_token, showOfflineAction]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
        {!session ? (
          <View className="gap-md border-y border-border py-xl"><Text className="font-body text-muted-text text-[14px]">You're not signed in.</Text><Pressable onPress={() => navigation.navigate('Login')} className="min-h-[44px] self-start justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[12px] uppercase">Sign in</Text></Pressable></View>
        ) : (
          <>
            <FadeInView delay={80}>
              <View className="items-center gap-md border-y border-border py-lg">
                <Pressable
                  onPress={() => avatarUrl && setPhotoPreviewOpen(true)}
                  disabled={!avatarUrl}
                  accessibilityRole="button"
                  accessibilityLabel={avatarUrl ? 'View profile photo' : 'Profile avatar'}
                  accessibilityState={{ disabled: !avatarUrl }}
                  className="h-[104px] w-[104px] rounded-full overflow-hidden border-2 border-lime bg-lime items-center justify-center active:opacity-80"
                >
                  {avatarUrl ? <Image source={{ uri: avatarUrl }} className="h-full w-full" resizeMode="cover" /> : <Text className="font-heading text-dark text-[42px]">{initial}</Text>}
                </Pressable>
                <View className="flex-row items-center gap-lg">
                  <Pressable onPress={() => void pickPhoto()} disabled={photoBusy} className="min-h-[40px] justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[11px] uppercase">{photoBusy ? 'Saving' : avatarUrl ? 'Change photo' : 'Add photo'}</Text></Pressable>
                  {avatarUrl ? <Pressable onPress={removePhoto} disabled={photoBusy} className="min-h-[40px] justify-center border-b border-red-300"><Text className="font-heading-bold text-red-300 text-[11px] uppercase">Remove</Text></Pressable> : null}
                </View>
                {!isOffline && message ? <Text accessibilityRole="alert" className="font-body text-tertiary-text text-[14px] text-center">{message}</Text> : null}
              </View>
            </FadeInView>

            <FadeInView delay={120}>
              <Card className="flex-row items-center gap-md"><View className="flex-1"><Text className="font-heading-semibold text-muted-text text-[11px] uppercase">Signed in as</Text><Text className="font-body-semibold text-white text-[16px] mt-xs" numberOfLines={1}>{email}</Text></View></Card>
            </FadeInView>

            <FadeInView delay={170}>
              <Pressable
                onPress={openMembership}
                accessibilityRole="button"
                accessibilityLabel={`Membership. ${membershipTitle}`}
                className="active:opacity-80"
              >
                <Card className="flex-row items-center gap-md">
                  <View className="h-[46px] w-[46px] rounded-full bg-lime items-center justify-center">
                    <Feather name="award" size={22} color={colors.dark} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-heading-semibold text-white text-[11px] uppercase">Membership</Text>
                    <Text className="font-heading-bold text-white text-[16px] mt-xs">{membershipTitle}</Text>
                    {membershipDescription ? <Text className="font-body text-white text-[14px] leading-[18px] mt-xs">{membershipDescription}</Text> : null}
                    {!dashboardLoading && !verifiedMembership ? (
                      <Text className="font-body text-white text-[13px] mt-xs">
                        Tap to try again
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.tertiaryText} />
                </Card>
              </Pressable>
            </FadeInView>
          </>
        )}
      </ScrollView>

      <Modal visible={photoPreviewOpen} transparent animationType="fade" onRequestClose={() => setPhotoPreviewOpen(false)}>
        <SafeAreaView className="flex-1 bg-black/95 px-lg py-lg">
          <View className="flex-row justify-end">
            <Pressable
              onPress={() => setPhotoPreviewOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close profile photo"
              className="h-[44px] w-[44px] rounded-full border border-white/20 items-center justify-center active:opacity-70"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Pressable onPress={() => setPhotoPreviewOpen(false)} className="flex-1 items-center justify-center">
            {avatarUrl ? <Image source={{ uri: avatarUrl }} className="w-full aspect-square rounded-full" resizeMode="cover" /> : null}
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
