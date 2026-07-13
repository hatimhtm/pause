import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, useAppTheme, useResponsive } from '@/theme';

// ---- Screen scaffold ----

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const c = useAppTheme();
  const r = useResponsive();
  const inner = (
    <View style={{ width: '100%', maxWidth: r.contentWidth, alignSelf: 'center', paddingHorizontal: r.gutter }}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}>
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
    </SafeAreaView>
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
    <View style={[styles.card, { backgroundColor: bg, borderColor: c.border }, style]}>{children}</View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
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
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? c.border : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.88 : 1,
        },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: spacing.sm }} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

// ---- Stat tile ----

export function StatTile({
  value,
  label,
  icon,
  tone = 'card',
}: {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'card' | 'primary';
}) {
  const c = useAppTheme();
  const primary = tone === 'primary';
  return (
    <View
      style={[
        styles.card,
        styles.tile,
        { backgroundColor: primary ? c.primary : c.card, borderColor: primary ? 'transparent' : c.border },
      ]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={primary ? c.onPrimary : c.primary}
          style={{ marginBottom: spacing.sm }}
        />
      ) : null}
      <Text style={{ color: primary ? c.onPrimary : c.text, fontSize: 26, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: primary ? c.onPrimary + 'CC' : c.textDim, fontSize: 12.5, marginTop: 2 }}>{label}</Text>
    </View>
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
          onValueChange={onValueChange}
          trackColor={{ true: c.primary, false: c.cardAlt }}
          thumbColor="#fff"
        />
      </View>
    </Card>
  );
}

// ---- Bar chart ----

export function BarChart({ values, labels, height = 120 }: { values: number[]; labels: string[]; height?: number }) {
  const c = useAppTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          <View
            style={{
              width: '58%',
              height: Math.max(4, (height - 24) * (v / max)),
              backgroundColor: v === max ? c.primary : c.primary + '99',
              borderRadius: 6,
            }}
          />
          <Text style={{ color: c.textFaint, fontSize: 11, marginTop: 6 }}>{labels[i]}</Text>
        </View>
      ))}
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
  const c = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => onChange(opt)}
            style={{
              paddingVertical: 9,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              backgroundColor: active ? c.primary : c.cardAlt,
            }}>
            <Text style={{ color: active ? c.onPrimary : c.text, fontWeight: '700', fontSize: 14 }}>
              {format ? format(opt) : String(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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

export function GradientHeader({ children }: { children: React.ReactNode }) {
  const c = useAppTheme();
  return (
    <LinearGradient colors={[c.overlayTop, c.overlayBottom]} style={{ borderRadius: radius.lg, padding: spacing.xl }}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
  },
});
