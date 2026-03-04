import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';
import { groupExercisesByPrimaryMuscle } from '@/lib/exercises/libraryService';
import type { ExerciseLibraryItem } from '@/lib/types';

type Props = {
  visible: boolean;
  exercises: ExerciseLibraryItem[];
  selectedExerciseId?: string | null;
  onSelect: (exercise: ExerciseLibraryItem) => void;
  onClose: () => void;
  onCreateFromQuery: (name: string) => void;
};

function matchExercise(exercise: ExerciseLibraryItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    exercise.name.toLowerCase().includes(q) ||
    exercise.primaryMuscleGroup.toLowerCase().includes(q) ||
    exercise.movementType.toLowerCase().includes(q) ||
    (exercise.equipment || '').toLowerCase().includes(q) ||
    exercise.targetMuscles.some((muscle) => muscle.toLowerCase().includes(q))
  );
}

function buildMetaChips(exercise: ExerciseLibraryItem): string[] {
  const chips = [exercise.movementType, exercise.primaryMuscleGroup];
  if (exercise.equipment) chips.push(exercise.equipment);
  return chips;
}

export default function ExercisePickerModal({
  visible,
  exercises,
  selectedExerciseId,
  onSelect,
  onClose,
  onCreateFromQuery,
}: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const filtered = useMemo(() => {
    return exercises.filter((exercise) => matchExercise(exercise, search));
  }, [exercises, search]);

  const grouped = useMemo(() => groupExercisesByPrimaryMuscle(filtered), [filtered]);
  const createLabel = search.trim().length > 0 ? `Create: ${search.trim()}` : 'Create New Exercise';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Exercise</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={C.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, muscle, equipment"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.quickCreateBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onCreateFromQuery(search.trim())}
          >
            <Ionicons name="add-circle-outline" size={18} color={C.primary} />
            <Text style={styles.quickCreateText}>{createLabel}</Text>
          </Pressable>

          {grouped.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={32} color={C.borderLight} />
              <Text style={styles.emptyTitle}>No exercises found</Text>
              <Text style={styles.emptySub}>Try another search or create a new exercise.</Text>
            </View>
          ) : (
            <SectionList
              sections={grouped}
              keyExtractor={(item) => item.id}
              stickySectionHeadersEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeaderWrap}>
                  <Text style={styles.sectionHeader}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const selected = item.id === selectedExerciseId;
                const chips = buildMetaChips(item);
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.item,
                      selected && styles.itemSelected,
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => onSelect(item)}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.chips}>
                        {chips.map((chip) => (
                          <View key={`${item.id}-${chip}`} style={styles.metaChip}>
                            <Text style={styles.metaChipText}>{chip}</Text>
                          </View>
                        ))}
                      </View>
                      {item.targetMuscles.length > 0 && (
                        <Text style={styles.targetText}>Targets: {item.targetMuscles.join(', ')}</Text>
                      )}
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'chevron-forward'}
                      size={18}
                      color={selected ? C.primary : C.textMuted}
                    />
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: C.text },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
  },
  quickCreateBtn: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primaryBg,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickCreateText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: C.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: C.textSecondary },
  emptySub: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: C.textMuted },
  listContent: {
    paddingTop: 10,
    paddingBottom: 18,
  },
  sectionHeaderWrap: {
    backgroundColor: C.surface,
    paddingVertical: 8,
  },
  sectionHeader: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: C.textSecondary,
    letterSpacing: 0.3,
  },
  item: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemSelected: {
    borderColor: C.primary + '90',
    backgroundColor: C.primaryBg,
  },
  itemName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: C.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borderLight,
    backgroundColor: C.surface3,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaChipText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: C.textSecondary,
    textTransform: 'capitalize',
  },
  targetText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: C.textMuted,
  },
});
