import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useFeedbackToast } from '@/context/FeedbackToastContext';
import { exercisesRepo, workoutsRepo } from '@/lib/storage';
import {
  deleteExercise,
  ensureExerciseLibraryInitialized,
  type ExerciseDraft,
  upsertExercise,
} from '@/lib/exercises/libraryService';
import type { ExerciseLibraryItem, WorkoutTemplate } from '@/lib/types';
import ExerciseFormModal from '@/components/ExerciseFormModal';

function countTemplateUsage(templates: WorkoutTemplate[], exerciseId: string): number {
  let count = 0;
  for (const template of templates) {
    for (const block of template.blocks) {
      if (block.type === 'gym' && block.exerciseId === exerciseId) {
        count += 1;
      }
    }
  }
  return count;
}

function matchesSearch(exercise: ExerciseLibraryItem, query: string): boolean {
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

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast, showUndoToast } = useFeedbackToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseLibraryItem | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      await ensureExerciseLibraryInitialized(user.id);
      const [library, allTemplates] = await Promise.all([
        exercisesRepo.getAll(user.id),
        workoutsRepo.getAll(user.id),
      ]);

      setExercises(library.sort((a, b) => a.name.localeCompare(b.name)));
      setTemplates(allTemplates);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(
    () => exercises.filter((exercise) => matchesSearch(exercise, search)),
    [exercises, search]
  );

  const openCreate = () => {
    setEditingExercise(null);
    setShowForm(true);
  };

  const openEdit = (exercise: ExerciseLibraryItem) => {
    setEditingExercise(exercise);
    setShowForm(true);
  };

  const handleSave = async (draft: ExerciseDraft) => {
    if (!user) return;

    try {
      setSaving(true);
      await upsertExercise(user.id, {
        ...draft,
        id: editingExercise?.id || draft.id,
      });
      await load();
      showToast({ message: 'Exercise saved', tone: 'success' });
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (exercise: ExerciseLibraryItem) => {
    if (!user) return;
    const deletedIndex = exercises.findIndex((item) => item.id === exercise.id);
    const restoreExercise = () => {
      setExercises((prev) => {
        if (prev.some((item) => item.id === exercise.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(Math.max(deletedIndex, 0), next.length), 0, exercise);
        return next;
      });
    };

    setExercises((prev) => prev.filter((item) => item.id !== exercise.id));

    showUndoToast({
      message: `${exercise.name} deleted`,
      durationMs: 10000,
      onUndo: restoreExercise,
      onCommit: async () => {
        try {
          await deleteExercise(user.id, exercise.id);
          await load();
        } catch (error) {
          restoreExercise();
          throw error;
        }
      },
      onCommitErrorMessage: 'Unable to delete exercise. Please try again.',
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.textSecondary} />
          </Pressable>
          <Text style={styles.pageTitle}>Exercise Library</Text>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={openCreate}
          >
            <Ionicons name="add" size={20} color={C.bg} />
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
          />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={36} color={C.borderLight} />
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySub}>Create exercises once, then reuse them in templates.</Text>
            <Pressable style={styles.emptyBtn} onPress={openCreate}>
              <Ionicons name="add" size={16} color={C.bg} />
              <Text style={styles.emptyBtnText}>Create exercise</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map((exercise) => {
            const alternativeCount = exercise.alternativeExerciseIds.length;
            const usageCount = countTemplateUsage(templates, exercise.id);

            return (
              <Pressable
                key={exercise.id}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
                onPress={() => openEdit(exercise)}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.cardName}>{exercise.name}</Text>
                    <Text style={styles.cardMeta}>
                      {exercise.movementType} • {exercise.primaryMuscleGroup}
                      {exercise.equipment ? ` • ${exercise.equipment}` : ''}
                    </Text>
                  </View>

                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(exercise)}>
                    <Ionicons name="trash-outline" size={16} color={C.error} />
                  </Pressable>
                </View>

                {exercise.targetMuscles.length > 0 && (
                  <Text style={styles.targetRow}>Targets: {exercise.targetMuscles.join(', ')}</Text>
                )}

                {!!exercise.coachingCues && (
                  <Text style={styles.cuesRow} numberOfLines={2}>
                    {exercise.coachingCues}
                  </Text>
                )}

                <View style={styles.footerRow}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Templates {usageCount}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Alternatives {alternativeCount}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Videos {exercise.referenceVideoUrls.length}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <ExerciseFormModal
        visible={showForm}
        title={editingExercise ? 'Edit Exercise' : 'New Exercise'}
        initialValue={
          editingExercise
            ? {
                id: editingExercise.id,
                name: editingExercise.name,
                coachingCues: editingExercise.coachingCues,
                movementType: editingExercise.movementType,
                primaryMuscleGroup: editingExercise.primaryMuscleGroup,
                targetMuscles: editingExercise.targetMuscles,
                equipment: editingExercise.equipment,
                referenceVideoUrls: editingExercise.referenceVideoUrls,
                alternativeExerciseIds: editingExercise.alternativeExerciseIds,
              }
            : undefined
        }
        existingExercises={exercises}
        onClose={() => {
          if (saving) return;
          setShowForm(false);
        }}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
  },
  addBtn: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  pageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 24, color: C.text },
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
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    color: C.text,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17, color: C.textSecondary },
  emptySub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    maxWidth: 250,
  },
  emptyBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  emptyBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: C.bg },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.surface2,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.error + '55',
  },
  cardName: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: C.text },
  cardMeta: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: C.textMuted,
    textTransform: 'capitalize',
  },
  targetRow: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: C.textSecondary,
  },
  cuesRow: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: C.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borderLight,
    backgroundColor: C.surface3,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: C.textSecondary,
  },
});
