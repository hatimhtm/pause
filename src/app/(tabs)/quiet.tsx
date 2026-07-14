import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Switch, View } from 'react-native';

import { DAY_LETTERS, daysSummary, minuteToTime } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { actions, newQuietId, useStoreSelector } from '@/lib/store';
import type { QuietHours } from '@/lib/types';
import { radius, spacing, useAppTheme } from '@/theme';
import { Appear, Body, Button, Card, Heading, Input, Label, PressableScale, Screen, Title } from '@/ui/kit';

export default function QuietScreen() {
  const c = useAppTheme();
  const quiet = useStoreSelector((s) => s.quiet);
  const [editing, setEditing] = useState<QuietHours | null>(null);
  const [open, setOpen] = useState(false);

  const startNew = () => {
    setEditing({ id: newQuietId(), label: '', startMinute: 22 * 60, endMinute: 7 * 60, daysMask: 0b1111111, enabled: true });
    setOpen(true);
  };

  return (
    <Screen>
      <Appear index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
          <Title>Quiet hours</Title>
          <Button title="New" icon="add" onPress={startNew} style={{ paddingVertical: 10, paddingHorizontal: spacing.lg }} />
        </View>
        <Body dim style={{ marginBottom: spacing.lg }}>
          During these windows every watched app gets the pause screen, and its notifications are muted.
        </Body>
      </Appear>

      {quiet.length === 0 ? (
        <Appear index={1}>
          <Card>
            <Body dim>No quiet hours yet. A bedtime window (say 10pm–7am) is a good start.</Body>
          </Card>
        </Appear>
      ) : (
        quiet.map((q, qi) => (
          <Appear key={q.id} index={1 + qi}>
            <Card onPress={() => { setEditing(q); setOpen(true); }} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Heading style={{ fontSize: 16 }}>{q.label || 'Quiet hours'}</Heading>
                  <Body dim style={{ fontSize: 13, marginTop: 2 }}>
                    {minuteToTime(q.startMinute)} – {minuteToTime(q.endMinute)}
                  </Body>
                  <Body faint style={{ fontSize: 12, marginTop: 2 }}>
                    {q.enabled ? daysSummary(q.daysMask) : 'Off'}
                  </Body>
                </View>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: q.enabled ? c.primary : c.textFaint }} />
              </View>
            </Card>
          </Appear>
        ))
      )}

      <Modal visible={open} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim }}>
          {editing ? (
            <Editor
              value={editing}
              onChange={setEditing}
              onSave={() => { actions.upsertQuiet(editing); setOpen(false); }}
              onDelete={() => { actions.removeQuiet(editing.id); setOpen(false); }}
              onCancel={() => setOpen(false)}
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

function Editor({
  value,
  onChange,
  onSave,
  onDelete,
  onCancel,
}: {
  value: QuietHours;
  onChange: (q: QuietHours) => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const c = useAppTheme();
  return (
    <View style={{ backgroundColor: c.bgElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xxxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
        <Heading style={{ flex: 1 }}>Quiet hours</Heading>
        <Switch
          value={value.enabled}
          accessibilityLabel="Quiet hours on"
          onValueChange={(v) => {
            tap();
            onChange({ ...value, enabled: v });
          }}
          trackColor={{ true: c.switchOn, false: c.cardAlt }}
          thumbColor="#fff"
        />
      </View>

      <Label style={{ marginBottom: spacing.sm }}>Name</Label>
      <Input
        value={value.label}
        onChangeText={(t) => onChange({ ...value, label: t })}
        placeholder="Bedtime"
      />

      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg }}>
        <TimeStepper label="From" minute={value.startMinute} onChange={(m) => onChange({ ...value, startMinute: m })} />
        <TimeStepper label="To" minute={value.endMinute} onChange={(m) => onChange({ ...value, endMinute: m })} />
      </View>

      <Label style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Days</Label>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {DAY_LETTERS.map((letter, day) => {
          const on = (value.daysMask & (1 << day)) !== 0;
          return (
            <PressableScale
              key={day}
              scaleTo={0.88}
              accessibilityLabel={`${letter} ${on ? 'on' : 'off'}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onChange({ ...value, daysMask: value.daysMask ^ (1 << day) });
              }}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.primary : c.cardAlt }}>
              <Body style={{ color: on ? c.onPrimary : c.text, fontWeight: '700' }}>{letter}</Body>
            </PressableScale>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
        <Button title="Delete" variant="danger" onPress={onDelete} style={{ flex: 1 }} />
        <Button title="Save" onPress={onSave} style={{ flex: 2 }} />
      </View>
      <Button title="Cancel" variant="ghost" onPress={onCancel} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

function TimeStepper({ label, minute, onChange }: { label: string; minute: number; onChange: (m: number) => void }) {
  const c = useAppTheme();
  const step = (deltaMin: number) => onChange(((minute + deltaMin) % 1440 + 1440) % 1440);
  return (
    <View style={{ flex: 1 }}>
      <Label style={{ marginBottom: spacing.sm }}>{label}</Label>
      <View style={{ backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, alignItems: 'center' }}>
        <Heading style={{ fontSize: 18 }}>{minuteToTime(minute)}</Heading>
        <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
          <StepBtn icon="remove" onPress={() => step(-60)} sub="1h" />
          <StepBtn icon="remove" onPress={() => step(-15)} sub="15m" />
          <StepBtn icon="add" onPress={() => step(15)} sub="15m" />
          <StepBtn icon="add" onPress={() => step(60)} sub="1h" />
        </View>
      </View>
    </View>
  );
}

function StepBtn({ icon, onPress, sub }: { icon: 'add' | 'remove'; onPress: () => void; sub: string }) {
  const c = useAppTheme();
  return (
    <PressableScale
      scaleTo={0.85}
      accessibilityLabel={`${icon === 'add' ? 'Add' : 'Subtract'} ${sub}`}
      onPress={() => {
        tap();
        onPress();
      }}
      // 44dp touch target around the 30dp visual
      style={{ alignItems: 'center', justifyContent: 'center', width: 44, paddingVertical: 7 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={c.text} />
      </View>
      <Body faint style={{ fontSize: 10, marginTop: 2 }}>{sub}</Body>
    </PressableScale>
  );
}
