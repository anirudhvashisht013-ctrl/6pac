import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { workoutsRepo } from '@/lib/storage';
import type { WorkoutTemplate, WorkoutBlock } from '@/lib/types';

const REPS_OPTIONS = ['Until Failure', ...Array.from({ length: 30 }, (_, i) => String(i + 1))];

type BlockType = 'gym' | 'cardio' | 'rest';

const DEFAULT_GYM: Partial<WorkoutBlock> = {
  type: 'gym', exerciseName: '', sets: 3, repsOption: '10', referenceVideoUrls: [], notes: '',
};
const DEFAULT_CARDIO: Partial<WorkoutBlock> = {
  type: 'cardio', cardioName: '', minutes: 20, notes: '',
};
const DEFAULT_REST: Partial<WorkoutBlock> = {
  type: 'rest', seconds: 60, label: 'Rest',
};

function BlockCard({
  block, idx, total, onEdit, onDelete, onMoveUp, onMoveDown,
}: {
  block: WorkoutBlock; idx: number; total: number;
  onEdit: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}) {
  return (
    <View style={styles.blockCard}>
      <View style={styles.blockCardLeft}>
        {block.type === 'gym' ? (
          <View style={[styles.blockTypeIcon, styles.blockTypeIconGym]}>
            <MaterialCommunityIcons name="dumbbell" size={16} color={C.primary} />
          </View>
        ) : block.type === 'cardio' ? (
          <View style={[styles.blockTypeIcon, styles.blockTypeIconCardio]}>
            <Ionicons name="bicycle-outline" size={16} color={C.secondary} />
          </View>
        ) : (
          <View style={[styles.blockTypeIcon, styles.blockTypeIconRest]}>
            <Ionicons name="timer-outline" size={16} color={C.textMuted} />
          </View>
        )}
        <View style={styles.blockInfo}>
          {block.type === 'gym' && (
            <>
              <Text style={styles.blockName}>{block.exerciseName || 'Exercise'}</Text>
              <Text style={styles.blockMeta}>{block.sets} sets · {block.repsOption} reps</Text>
            </>
          )}
          {block.type === 'cardio' && (
            <>
              <Text style={styles.blockName}>{block.cardioName || 'Cardio'}</Text>
              <Text style={styles.blockMeta}>{block.minutes} min</Text>
            </>
          )}
          {block.type === 'rest' && (
            <>
              <Text style={styles.blockName}>{block.label || 'Rest'}</Text>
              <Text style={styles.blockMeta}>{block.seconds}s</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.blockActions}>
        <Pressable onPress={onMoveUp} disabled={idx === 0} style={styles.blockActionBtn}>
          <Ionicons name="chevron-up" size={16} color={idx === 0 ? C.border : C.textSecondary} />
        </Pressable>
        <Pressable onPress={onMoveDown} disabled={idx === total - 1} style={styles.blockActionBtn}>
          <Ionicons name="chevron-down" size={16} color={idx === total - 1 ? C.border : C.textSecondary} />
        </Pressable>
        <Pressable onPress={onEdit} style={styles.blockActionBtn}>
          <Ionicons name="pencil-outline" size={16} color={C.primary} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.blockActionBtn}>
          <Ionicons name="trash-outline" size={16} color={C.error} />
        </Pressable>
      </View>
    </View>
  );
}

export default function EditorScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editingBlock, setEditingBlock] = useState<WorkoutBlock | null>(null);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [blockDraft, setBlockDraft] = useState<Partial<WorkoutBlock>>({});
  const [showRepsModal, setShowRepsModal] = useState(false);

  useEffect(() => {
    if (isNew || !user) { setLoading(false); return; }
    workoutsRepo.getById(user.id, id).then(t => {
      if (t) { setName(t.name); setBlocks(t.blocks); }
      setLoading(false);
    });
  }, [id, user]);

  const save = async () => {
    if (!user || !name.trim()) { Alert.alert('Name required', 'Please enter a workout name'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const template: WorkoutTemplate = {
      id: isNew ? Crypto.randomUUID() : id,
      name: name.trim(),
      blocks,
      createdAt: now,
      updatedAt: now,
    };
    await workoutsRepo.save(user.id, template);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  const openAddBlock = (type: BlockType) => {
    const draft = type === 'gym' ? { ...DEFAULT_GYM } : type === 'cardio' ? { ...DEFAULT_CARDIO } : { ...DEFAULT_REST };
    setBlockDraft({ ...draft, id: Crypto.randomUUID() });
    setEditingBlock(null);
    setEditingBlockIdx(null);
    setShowAddModal(false);
    setShowEditModal(true);
  };

  const openEditBlock = (block: WorkoutBlock, idx: number) => {
    setBlockDraft({ ...block });
    setEditingBlock(block);
    setEditingBlockIdx(idx);
    setShowEditModal(true);
  };

  const saveBlock = () => {
    if (!blockDraft.id) return;
    const block = blockDraft as WorkoutBlock;
    if (editingBlockIdx !== null) {
      const newBlocks = [...blocks];
      newBlocks[editingBlockIdx] = block;
      setBlocks(newBlocks);
    } else {
      setBlocks(prev => [...prev, block]);
    }
    setShowEditModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteBlock = (idx: number) => {
    Alert.alert('Delete block?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setBlocks(prev => prev.filter((_, i) => i !== idx)) },
    ]);
  };

  const moveBlock = (idx: number, dir: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    [newBlocks[idx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[idx]];
    setBlocks(newBlocks);
  };

  if (loading) {
    return <View style={[styles.centerFlex, { backgroundColor: C.bg }]}><ActivityIndicator color={C.primary} /></View>;
  }

  const blockType = blockDraft.type;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>{isNew ? 'New Workout' : 'Edit Workout'}</Text>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color={C.bg} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.nameField}>
          <Text style={styles.fieldLabel}>Workout Name</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Upper Body Push"
            placeholderTextColor={C.textMuted}
            autoFocus={isNew}
          />
        </View>

        <View style={styles.blocksHeader}>
          <Text style={styles.sectionTitle}>Blocks ({blocks.length})</Text>
          <Pressable
            style={({ pressed }) => [styles.addBlockBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={18} color={C.primary} />
            <Text style={styles.addBlockBtnText}>Add Block</Text>
          </Pressable>
        </View>

        {blocks.length === 0 ? (
          <View style={styles.emptyBlocks}>
            <Ionicons name="cube-outline" size={40} color={C.border} />
            <Text style={styles.emptyText}>No blocks yet — add exercises, cardio or rest periods</Text>
          </View>
        ) : (
          blocks.map((block, idx) => (
            <BlockCard
              key={block.id}
              block={block}
              idx={idx}
              total={blocks.length}
              onEdit={() => openEditBlock(block, idx)}
              onDelete={() => deleteBlock(idx)}
              onMoveUp={() => moveBlock(idx, 'up')}
              onMoveDown={() => moveBlock(idx, 'down')}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Add Block</Text>
            {([
              { type: 'gym' as BlockType, label: 'Exercise (Gym)', icon: 'dumbbell', color: C.primary },
              { type: 'cardio' as BlockType, label: 'Cardio', icon: 'bicycle-outline', color: C.secondary },
              { type: 'rest' as BlockType, label: 'Rest / Timer', icon: 'timer-outline', color: C.textMuted },
            ]).map(({ type, label, icon, color }) => (
              <Pressable key={type} style={styles.addOption} onPress={() => openAddBlock(type)}>
                {type === 'gym' ? (
                  <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                ) : (
                  <Ionicons name={icon as any} size={20} color={color} />
                )}
                <Text style={styles.addOptionText}>{label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>
                {blockType === 'gym' ? 'Exercise Block' : blockType === 'cardio' ? 'Cardio Block' : 'Rest Block'}
              </Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editForm}>
                {blockType === 'gym' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Exercise Name</Text>
                      <TextInput
                        style={styles.formInput}
                        value={blockDraft.exerciseName || ''}
                        onChangeText={v => setBlockDraft(d => ({ ...d, exerciseName: v }))}
                        placeholder="e.g. Bench Press"
                        placeholderTextColor={C.textMuted}
                        autoFocus
                      />
                    </View>
                    <View style={styles.formRow}>
                      <View style={[styles.formField, { flex: 1 }]}>
                        <Text style={styles.formLabel}>Sets</Text>
                        <TextInput
                          style={styles.formInput}
                          value={blockDraft.sets != null ? String(blockDraft.sets) : ''}
                          onChangeText={v => setBlockDraft(d => ({ ...d, sets: parseInt(v) || 1 }))}
                          keyboardType="numeric"
                          placeholder="3"
                          placeholderTextColor={C.textMuted}
                        />
                      </View>
                      <View style={[styles.formField, { flex: 1 }]}>
                        <Text style={styles.formLabel}>Reps</Text>
                        <Pressable style={styles.repsBtn} onPress={() => setShowRepsModal(true)}>
                          <Text style={styles.repsBtnText}>{blockDraft.repsOption || '10'}</Text>
                          <Ionicons name="chevron-down" size={14} color={C.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Notes (optional)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={blockDraft.notes || ''}
                        onChangeText={v => setBlockDraft(d => ({ ...d, notes: v }))}
                        placeholder="Coaching cues..."
                        placeholderTextColor={C.textMuted}
                      />
                    </View>
                  </>
                )}

                {blockType === 'cardio' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Cardio Name</Text>
                      <TextInput
                        style={styles.formInput}
                        value={blockDraft.cardioName || ''}
                        onChangeText={v => setBlockDraft(d => ({ ...d, cardioName: v }))}
                        placeholder="e.g. Treadmill"
                        placeholderTextColor={C.textMuted}
                        autoFocus
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Duration (minutes)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={blockDraft.minutes != null ? String(blockDraft.minutes) : ''}
                        onChangeText={v => setBlockDraft(d => ({ ...d, minutes: parseInt(v) || 10 }))}
                        keyboardType="numeric"
                        placeholder="20"
                        placeholderTextColor={C.textMuted}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Notes (optional)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={blockDraft.notes || ''}
                        onChangeText={v => setBlockDraft(d => ({ ...d, notes: v }))}
                        placeholder="Pace, resistance..."
                        placeholderTextColor={C.textMuted}
                      />
                    </View>
                  </>
                )}

                {blockType === 'rest' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Label</Text>
                      <TextInput
                        style={styles.formInput}
                        value={blockDraft.label || ''}
                        onChangeText={v => setBlockDraft(d => ({ ...d, label: v }))}
                        placeholder="Rest"
                        placeholderTextColor={C.textMuted}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Duration (seconds)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={blockDraft.seconds != null ? String(blockDraft.seconds) : ''}
                        onChangeText={v => setBlockDraft(d => ({ ...d, seconds: parseInt(v) || 60 }))}
                        keyboardType="numeric"
                        placeholder="60"
                        placeholderTextColor={C.textMuted}
                        autoFocus
                      />
                    </View>
                    <View style={styles.quickRests}>
                      {[30, 60, 90, 120].map(s => (
                        <Pressable
                          key={s}
                          style={[styles.quickRestBtn, blockDraft.seconds === s && styles.quickRestBtnActive]}
                          onPress={() => setBlockDraft(d => ({ ...d, seconds: s }))}
                        >
                          <Text style={[styles.quickRestText, blockDraft.seconds === s && styles.quickRestTextActive]}>
                            {s}s
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <Pressable style={styles.saveBlockBtn} onPress={saveBlock}>
                  <Text style={styles.saveBlockBtnText}>
                    {editingBlockIdx !== null ? 'Update Block' : 'Add Block'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showRepsModal} transparent animationType="fade" onRequestClose={() => setShowRepsModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRepsModal(false)}>
          <View style={styles.repsModal}>
            <Text style={styles.repsModalTitle}>Select Reps</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {REPS_OPTIONS.map(opt => (
                <Pressable
                  key={opt}
                  style={[styles.repsOption, blockDraft.repsOption === opt && styles.repsOptionActive]}
                  onPress={() => {
                    setBlockDraft(d => ({ ...d, repsOption: opt }));
                    setShowRepsModal(false);
                  }}
                >
                  <Text style={[styles.repsOptionText, blockDraft.repsOption === opt && styles.repsOptionTextActive]}>
                    {opt}
                  </Text>
                  {blockDraft.repsOption === opt && <Ionicons name="checkmark" size={16} color={C.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
  },
  saveBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  nameField: { marginBottom: 24 },
  fieldLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted, marginBottom: 8 },
  nameInput: {
    backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, height: 52, fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: C.text,
  },
  blocksHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary },
  addBlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primaryBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: C.primary + '60',
  },
  addBlockBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: C.primary },
  emptyBlocks: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' },
  blockCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8,
  },
  blockCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  blockTypeIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  blockTypeIconGym: { backgroundColor: C.primaryBg },
  blockTypeIconCardio: { backgroundColor: C.secondaryBg },
  blockTypeIconRest: { backgroundColor: C.surface3 },
  blockInfo: { flex: 1, gap: 2 },
  blockName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.text },
  blockMeta: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted },
  blockActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  blockActionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  addModal: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 34, gap: 10,
  },
  addModalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text, marginBottom: 4 },
  addOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border,
  },
  addOptionText: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: C.textSecondary, flex: 1 },
  editModal: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editModalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: C.text },
  editForm: { gap: 14, paddingBottom: 20 },
  formField: { gap: 8 },
  formRow: { flexDirection: 'row', gap: 10 },
  formLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  formInput: {
    backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, height: 48, fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text,
  },
  repsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, height: 48,
  },
  repsBtnText: { fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.text },
  quickRests: { flexDirection: 'row', gap: 8 },
  quickRestBtn: {
    flex: 1, height: 44, borderRadius: 10, backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
  },
  quickRestBtnActive: { backgroundColor: C.primaryBg, borderColor: C.primary },
  quickRestText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: C.textMuted },
  quickRestTextActive: { color: C.primary },
  saveBlockBtn: {
    height: 52, borderRadius: 12, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBlockBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.bg },
  repsModal: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 34,
  },
  repsModalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: C.text, marginBottom: 12 },
  repsOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  repsOptionActive: { backgroundColor: C.primaryBg },
  repsOptionText: { fontFamily: 'Outfit_400Regular', fontSize: 16, color: C.textSecondary },
  repsOptionTextActive: { color: C.primary, fontFamily: 'Outfit_600SemiBold' },
});
