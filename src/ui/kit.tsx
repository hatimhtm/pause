import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tap } from '@/lib/haptics';
import { radius, spacing, useAppTheme, useResponsive } from '@/theme';

// ---- Screen scaffold ----

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'left', 'right'],
  refreshing = false,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const c = useAppTheme();
  const r = useResponsive();
  const inner = (
    <View
      style={{
        width: '100%',
        maxWidth: r.contentWidth,
        alignSelf: 'center',
        paddingHorizontal: r.gutter,
        flex: scroll ? undefined : 1,
      }}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          // room for the floating pill tab bar plus breathing space
          contentContainerStyle={{ paddingBottom: spacing.xxxl * 3 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[c.primary]}
                progressBackgroundColor={c.bgElevated}
                tintColor={c.primary}
              />
            ) : undefined
          }>
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
    </SafeAreaView>
  );
}

// ---- iOS-style pressable ----

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The press animates in (fast ease-out) and releases back (slower ease-out) instead of
 * snapping between two states — the iOS button feel. Use for every tappable surface.
 */
export function PressableScale({
  onPress,
  disabled,
  scaleTo = 0.97,
  style,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        scale.value = withTiming(scaleTo, { duration: 110, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
      }}
      onPress={onPress}
      style={[style, aStyle]}>
      {children}
    </AnimatedPressable>
  );
}

// ---- Entrance animation ----

/** Staggered fade-slide-in for list items and sections. `index` sets the stagger slot. */
export function Appear({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)
        .easing(Easing.out(Easing.cubic))
        .delay(Math.min(index, 8) * 40)}
      style={style}>
      {children}
    </Animated.View>
  );
}

// ---- Text ----

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useAppTheme();
  const r = useResponsive();
  return <Text style={[{ color: c.text, fontSize: 30 * r.scale, fontWeight: '800', letterSpacing: -0.5 }, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useAppTheme();
  return <Text style={[{ color: c.text, fontSize: 20, fontWeight: '700' }, style]}>{children}</Text>;
}

export function Body({
  children,
  dim,
  faint,
  style,
}: {
  children: React.ReactNode;
  dim?: boolean;
  faint?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const c = useAppTheme();
  return (
    <Text style={[{ color: faint ? c.textFaint : dim ? c.textDim : c.text, fontSize: 15, lineHeight: 21 }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useAppTheme();
  return (
    <Text style={[{ color: c.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

// ---- Card ----

export function Card({
  children,
  onPress,
  style,
  tone = 'card',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'card' | 'primarySoft' | 'accent';
}) {
  const c = useAppTheme();
  const bg = tone === 'primarySoft' ? c.primarySoft : tone === 'accent' ? c.accent + '22' : c.card;
  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: c.border,
          shadowColor: '#000',
          shadowOpacity: c.scheme === 'dark' ? 0 : 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: c.scheme === 'dark' ? 0 : 2,
        },
        style,
      ]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => {
        tap();
        onPress();
      }}>
      {body}
    </PressableScale>
  );
}

// ---- Buttons ----

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useAppTheme();
  const bg =
    variant === 'primary' ? c.primary : variant === 'secondary' ? c.cardAlt : 'transparent';
  const fg =
    variant === 'primary'
      ? c.onPrimary
      : variant === 'danger'
        ? c.danger
        : variant === 'ghost'
          ? c.primary
          : c.text;
  return (
    <PressableScale
      disabled={disabled}
      scaleTo={0.97}
      onPress={
        disabled
          ? undefined
          : () => {
              tap();
              onPress?.();
            }
      }
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? c.border : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: spacing.sm }} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
    </PressableScale>
  );
}

// ---- Stat tile ----

export function StatTile({
  value,
  label,
  icon,
  tone = 'card',
  onPress,
}: {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'card' | 'primary';
  onPress?: () => void;
}) {
  const c = useAppTheme();
  const primary = tone === 'primary';
  const inner = (
    <View
      style={[
        styles.card,
        styles.tile,
        { backgroundColor: primary ? c.primary : c.card, borderColor: primary ? 'transparent' : c.border },
      ]}>
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primary ? '#FFFFFF22' : c.primarySoft,
            marginBottom: spacing.sm,
          }}>
          <Ionicons name={icon} size={17} color={primary ? c.onPrimary : c.primary} />
        </View>
      ) : null}
      <Text style={{ color: primary ? c.onPrimary : c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ color: primary ? c.onPrimary + 'CC' : c.textDim, fontSize: 12.5, marginTop: 2 }}>{label}</Text>
    </View>
  );
  if (!onPress) return <View style={{ flex: 1 }}>{inner}</View>;
  return (
    <PressableScale
      scaleTo={0.975}
      style={{ flex: 1 }}
      onPress={() => {
        tap();
        onPress();
      }}>
      {inner}
    </PressableScale>
  );
}

// ---- App avatar ----

export function AppAvatar({ icon, size = 44 }: { icon?: string | null; size?: number }) {
  const c = useAppTheme();
  if (icon) {
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: size, height: size, borderRadius: size * 0.28 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: c.cardAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name="apps" size={size * 0.5} color={c.textFaint} />
    </View>
  );
}

// ---- Row with switch ----

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const c = useAppTheme();
  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
          {subtitle ? <Text style={{ color: c.textDim, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={(v) => {
            tap();
            onValueChange(v);
          }}
          trackColor={{ true: c.primary, false: c.cardAlt }}
          thumbColor="#fff"
        />
      </View>
    </Card>
  );
}

// ---- Bar chart ----

export function BarChart({
  values,
  labels,
  height = 132,
  activeIndex,
  onBarPress,
  formatValue,
}: {
  values: number[];
  labels: string[];
  height?: number;
  /** Highlighted bar (defaults to the max). */
  activeIndex?: number;
  onBarPress?: (index: number) => void;
  /** Shown above each non-zero bar; keep it short. */
  formatValue?: (v: number) => string;
}) {
  const c = useAppTheme();
  const max = Math.max(1, ...values);
  const highlight = activeIndex ?? values.indexOf(Math.max(...values));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
      {values.map((v, i) => {
        const active = i === highlight;
        const bar = (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            {formatValue && v > 0 ? (
              <Text style={{ color: active ? c.text : c.textFaint, fontSize: 10, fontWeight: '700', marginBottom: 3 }}>
                {formatValue(v)}
              </Text>
            ) : null}
            {/* keyed by value so fresh data re-plays the grow-in */}
            <Animated.View
              key={`${i}-${v}`}
              entering={FadeInUp.duration(320)
                .easing(Easing.out(Easing.cubic))
                .delay(i * 35)}
              style={{
                width: '58%',
                height: Math.max(4, (height - 40) * (v / max)),
                backgroundColor: active ? c.primary : c.primary + '55',
                borderRadius: 7,
              }}
            />
            <Text
              style={{
                color: active ? c.text : c.textFaint,
                fontSize: 11,
                fontWeight: active ? '800' : '400',
                marginTop: 6,
              }}>
              {labels[i]}
            </Text>
          </View>
        );
        if (!onBarPress) return <React.Fragment key={i}>{bar}</React.Fragment>;
        return (
          <Pressable key={i} onPress={() => onBarPress(i)} style={{ flex: 1, height: '100%' }}>
            {bar}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- Misc ----

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => (
        <Chip
          key={String(opt)}
          label={format ? format(opt) : String(opt)}
          active={opt === value}
          onPress={() => {
            tap();
            onChange(opt);
          }}
        />
      ))}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useAppTheme();
  return (
    <PressableScale
      scaleTo={0.93}
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: active ? c.primary : c.cardAlt,
      }}>
      <Text style={{ color: active ? c.onPrimary : c.text, fontWeight: '700', fontSize: 14 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function Spinner() {
  const c = useAppTheme();
  return (
    <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

export function GradientHeader({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const c = useAppTheme();
  const inner = (
    <LinearGradient
      colors={[c.overlayTop, c.overlayBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden' }}>
      {/* soft decorative circles */}
      <View style={[styles.deco, { width: 190, height: 190, top: -70, right: -50 }]} />
      <View style={[styles.deco, { width: 110, height: 110, bottom: -40, left: -30 }]} />
      {children}
    </LinearGradient>
  );
  if (!onPress) return inner;
  return (
    <PressableScale
      scaleTo={0.985}
      onPress={() => {
        tap();
        onPress();
      }}>
      {inner}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  tile: {
    flex: 1,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deco: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFFFFF14',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
  },
});
