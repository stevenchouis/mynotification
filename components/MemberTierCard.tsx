// components/MemberTierCard.tsx
// 「紅利點數」畫面上方的會員等級卡片（見 plan-member-tier.md）：等級徽章、今年累計消費、
// 升級進度條、等級效期，以及可展開的三個等級權益對照。資料來自 GET /loyalty/me，
// 舊後端沒有 tier 欄位時呼叫端不要渲染這個元件。
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import Text from './Text';
import TierBadge from './TierBadge';
import { ThemeColors } from '../constants/Colors';
import { MEMBER_TIER_ORDER, MEMBER_TIERS, MemberTier, isMemberTier } from '../constants/loyalty';
import { useThemeColors } from '../hooks/useThemeColors';
import { LoyaltyMe } from '../types/loyalty';

const formatMoney = (amount: number) => `NT$${amount.toLocaleString('zh-TW')}`;

export default function MemberTierCard({ me, tier }: { me: LoyaltyMe; tier: MemberTier }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showBenefits, setShowBenefits] = useState(false);

  const yearSpend = me.year_spend ?? 0;
  const nextTier = isMemberTier(me.next_tier) ? me.next_tier : null;
  const amountToNext = me.amount_to_next_tier ?? null;
  // 進度條：今年累計 ÷ 下一級門檻。等級可能是靠去年消費維持的，所以不從目前等級的門檻起算
  const progress = nextTier ? Math.min(1, yearSpend / MEMBER_TIERS[nextTier].threshold) : 1;
  const multiplier = me.earn_multiplier ?? MEMBER_TIERS[tier].multiplier;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TierBadge tier={tier} />
        <Text style={styles.multiplierText}>點數 {multiplier} 倍回饋</Text>
      </View>

      <Text style={styles.spendLabel}>今年累計消費</Text>
      <Text style={styles.spendValue}>{formatMoney(yearSpend)}</Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: MEMBER_TIERS[nextTier ?? tier].badgeColor }]} />
      </View>
      <Text style={styles.progressText}>
        {nextTier && amountToNext != null
          ? `再消費 ${formatMoney(amountToNext)} 升級${MEMBER_TIERS[nextTier].label}`
          : '已是最高等級，感謝您的支持'}
      </Text>
      {me.tier_expires_at && (
        <Text style={styles.expiryText}>
          {MEMBER_TIERS[tier].label}效期至 {new Date(me.tier_expires_at).toLocaleDateString('zh-TW')}
        </Text>
      )}

      <Pressable style={styles.benefitsToggle} onPress={() => setShowBenefits((v) => !v)} hitSlop={8}>
        <Text style={styles.benefitsToggleText}>等級權益</Text>
        <Ionicons name={showBenefits ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>

      {showBenefits && (
        <View style={styles.benefitsTable}>
          {MEMBER_TIER_ORDER.map((key) => {
            const config = MEMBER_TIERS[key];
            const isCurrent = key === tier;
            return (
              <View key={key} style={[styles.benefitRow, isCurrent && styles.benefitRowCurrent]}>
                <View style={styles.benefitTierCell}>
                  <TierBadge tier={key} size="sm" />
                  <Text style={styles.benefitThreshold}>
                    {config.threshold === 0 ? '註冊即享' : `年消費 ${formatMoney(config.threshold)}`}
                  </Text>
                </View>
                <View style={styles.benefitDetailCell}>
                  <Text style={styles.benefitText}>點數 {config.multiplier} 倍</Text>
                  {config.upgradeCoupon != null && (
                    <Text style={styles.benefitText}>升等禮券 ${config.upgradeCoupon}</Text>
                  )}
                  <Text style={styles.benefitText}>
                    生日禮券{config.birthdayMultiplier === 1 ? '' : ` ×${config.birthdayMultiplier}`}
                  </Text>
                </View>
              </View>
            );
          })}
          <Text style={styles.benefitNote}>
            等級依自然年度（1/1～12/31）累計消費計算，今年達標即升等，效期至明年底。
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  multiplierText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  spendLabel: { fontSize: 12, color: colors.textMuted },
  spendValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 13, color: colors.text, marginTop: 8 },
  expiryText: { fontSize: 12, color: colors.textSubtle, marginTop: 4 },
  benefitsToggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 12 },
  benefitsToggleText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  benefitsTable: { marginTop: 10, gap: 8 },
  benefitRow: {
    flexDirection: 'row', borderRadius: 10, padding: 10, backgroundColor: colors.background,
    borderWidth: 1, borderColor: 'transparent',
  },
  benefitRowCurrent: { borderColor: colors.tint },
  benefitTierCell: { width: 120, gap: 4 },
  benefitThreshold: { fontSize: 11, color: colors.textSubtle },
  benefitDetailCell: { flex: 1, gap: 2 },
  benefitText: { fontSize: 12, color: colors.text },
  benefitNote: { fontSize: 11, color: colors.textSubtle, marginTop: 2, lineHeight: 16 },
});
