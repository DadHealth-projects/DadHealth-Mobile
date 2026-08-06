import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import AppTopBar from '../../components/AppTopBar';
import Card from '../../components/Card';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk')
  .replace(/^https:\/\/dadhealth\.co\.uk(?=\/|$)/, 'https://www.dadhealth.co.uk')
  .replace(/\/$/, '');

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { session, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(typeof user?.user_metadata?.dadhealth_avatar_url === 'string' ? user.user_metadata.dadhealth_avatar_url : null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const email = user?.email ?? '0';
  const initial = (user?.email?.[0] ?? '?').toUpperCase();

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('user_profile').select('avatar_url').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (typeof data?.avatar_url === 'string') setAvatarUrl(data.avatar_url);
    });
  }, [user?.id]);

  const pickPhoto = useCallback(async () => {
    if (!session?.access_token) return;
    setMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setMessage('Photo access is required to choose a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    setPhotoBusy(true);
    try {
      const prepared = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 800, height: 800 } }], { compress: 0.84, format: ImageManipulator.SaveFormat.JPEG });
      const form = new FormData();
      form.append('photo', { uri: prepared.uri, name: 'profile.jpg', type: 'image/jpeg' } as unknown as Blob);
      const response = await fetch(`${WEB_URL}/api/profile/photo`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.avatar_url !== 'string') throw new Error('upload_failed');
      setAvatarUrl(body.avatar_url);
      await supabase.auth.updateUser({ data: { dadhealth_avatar_url: body.avatar_url } });
      setMessage('Profile photo updated.');
    } catch {
      setMessage('We could not save your profile photo. Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  }, [session?.access_token]);

  const removePhoto = useCallback(() => {
    if (!session?.access_token) return;
    Alert.alert('Remove profile photo?', 'Your account will use your initial instead.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void (async () => {
        setPhotoBusy(true); setMessage(null);
        try {
          const response = await fetch(`${WEB_URL}/api/profile/photo`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
          if (!response.ok) throw new Error('remove_failed');
          setAvatarUrl(null);
          await supabase.auth.updateUser({ data: { dadhealth_avatar_url: null } });
          setMessage('Profile photo removed.');
        } catch { setMessage('We could not remove your profile photo. Please try again.'); }
        finally { setPhotoBusy(false); }
      })() },
    ]);
  }, [session?.access_token]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close profile" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        {!session ? (
          <View className="gap-md border-y border-border py-xl"><Text className="font-body text-white/50 text-[14px]">You're not signed in.</Text><Pressable onPress={() => navigation.navigate('Login')} className="min-h-[44px] self-start justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[12px] uppercase">Sign in</Text></Pressable></View>
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
              </View>
            </FadeInView>

            <FadeInView delay={120}>
              <Card className="flex-row items-center gap-md"><View className="flex-1"><Text className="font-heading-semibold text-muted-text text-[11px] uppercase">Signed in as</Text><Text className="font-body-semibold text-white text-[16px] mt-xs" numberOfLines={1}>{email}</Text></View></Card>
            </FadeInView>

            <FadeInView delay={170}>
              <Pressable onPress={() => void Linking.openURL(`${WEB_URL}/progress`)} className="active:opacity-80"><Card className="flex-row items-center gap-md"><View className="h-[46px] w-[46px] items-center justify-center"><Feather name="external-link" size={21} color={colors.lime} /></View><View className="flex-1"><Text className="font-heading-bold text-white text-[16px] uppercase">Open web dashboard</Text><Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">View Dad Health on the web.</Text></View><Feather name="chevron-right" size={20} color={colors.tertiaryText} /></Card></Pressable>
            </FadeInView>
          </>
        )}
        {message ? <Text accessibilityRole="alert" className="font-body text-white/55 text-[12px]">{message}</Text> : null}
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
