import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import CircleCard from '../components/mockup/CircleCard';
import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import FeedPost from '../components/mockup/FeedPost';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import SectionHeader from '../components/dashboard/SectionHeader';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { CAPS } from '../lib/dashboardCaps';
import { dashboardIcon } from '../lib/dashboardIcons';
import { colors } from '../theme';

/**
 * Squad tab — the web dashboard COMMUNITY screen's features
 * (`dashboardPreview/CommunityScreen.tsx`: recent posts, dad circles) in
 * Mockup 4's layout: 2-column circles grid with join state, then feed posts.
 */
export default function CommunityScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const { user } = useAuth();
  const { data, loading, error, refresh, toggleCircle } = useDashboard(user?.id);

  const hasUser = Boolean(user?.id);
  const onRefresh = useCallback(() => void refresh(), [refresh]);
  const onToggleCircle = useCallback(
    (circleId: string, joined: boolean) => void toggleCircle(circleId, joined),
    [toggleCircle],
  );

  const circles = useMemo(() => (data?.circles ?? []).slice(0, CAPS.circles), [data?.circles]);
  const posts = useMemo(() => (data?.posts ?? []).slice(0, 3), [data?.posts]);

  return (
    <PillarScreen
      loading={loading && !data}
      skeleton={<PillarSkeleton cards={3} />}
      refreshing={loading}
      onRefresh={hasUser ? onRefresh : undefined}
      error={data ? null : error}
      onRetry={onRefresh}
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <FadeInView>
        <ScreenHero
          eyebrow="Dad Circles"
          headline={'Your people\nare in here.'}
          sub="Anonymous if you need it. No judgment. Just dads being honest."
        />
      </FadeInView>

      <FadeInView delay={90}>
        {circles.length === 0 ? (
          <Text className="font-body text-white/50 text-[14px]">No circles yet</Text>
        ) : (
          <View className="flex-row flex-wrap gap-sm">
            {circles.map((circle) => (
              <View key={circle.id} className="w-[48%]">
                <CircleCard
                  id={circle.id}
                  leading={
                    <Feather
                      name={dashboardIcon(circle.icon ?? 'community')}
                      size={18}
                      color={colors.lime}
                    />
                  }
                  name={circle.name}
                  membersCount={circle.members_count}
                  joined={circle.joined}
                  onToggle={hasUser ? onToggleCircle : undefined}
                />
              </View>
            ))}
          </View>
        )}
      </FadeInView>

      <FadeInView delay={140}>
        <SectionHeader title="Recent posts" className="mb-md" />
        {posts.length === 0 ? (
          <Text className="font-body text-white/50 text-[14px]">
            {hasUser ? 'No posts yet.' : 'Sign in to see the live feed.'}
          </Text>
        ) : (
          <View className="gap-sm">
            {posts.map((post) => (
              <FeedPost
                key={post.id}
                authorName={post.authorName}
                authorInitials={post.authorInitials}
                anonymous={post.anonymous}
                tag={post.tag}
                body={post.body}
              />
            ))}
          </View>
        )}
      </FadeInView>
    </PillarScreen>
  );
}
