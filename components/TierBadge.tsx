// components/TierBadge.tsx
// 會員等級小徽章（見 plan-member-tier.md），用在紅利點數、會員條碼等畫面。
// 底色是會員卡品牌色（constants/loyalty.ts 的 badgeColor），刻意不隨深淺色主題切換。
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import Text from './Text';
import { MEMBER_TIERS, MemberTier } from '../constants/loyalty';

export default function TierBadge({ tier, size = 'md' }: { tier: MemberTier; size?: 'sm' | 'md' }) {
  const config = MEMBER_TIERS[tier];
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall, { backgroundColor: config.badgeColor }]}>
      <Ionicons name={tier === 'regular' ? 'person' : 'diamond'} size={isSmall ? 11 : 13} color="#FFFFFF" />
      <Text style={[styles.text, isSmall && styles.textSmall]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  textSmall: { fontSize: 11 },
});
