import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';
import { MAX_REFERENCE_VIDEO_URLS } from '@/lib/exercises/constants';
import { groupExercisesByPrimaryMuscle, type ExerciseDraft } from '@/lib/exercises/libraryService';
import type { ExerciseLibraryItem, ExerciseMovementType } from '@/lib/types';

type Props = {
  visible: boolean;
  title: string;
  initialValue?: ExerciseDraft;
  existingExercises: ExerciseLibraryItem[];
  onClose: () => void;
  onSave: (draft: ExerciseDraft) => Promise<void> | void;
};

function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function uniqueByCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const clean = normalizeWhitespace(value);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next;
}

function normalizedUrlKey(input: string): string {
  return input.replace(/\s+/g, '').toLowerCase();
}

function appendReferenceVideo(existing: string[], draft: string): string[] {
  const clean = normalizeWhitespace(draft);
  if (!clean) return existing;
  if (existing.length >= MAX_REFERENCE_VIDEO_URLS) return existing;

  const nextKey = normalizedUrlKey(clean);
  const alreadyExists = existing.some((url) => normalizedUrlKey(url) === nextKey);
  if (alreadyExists) return existing;

  return [...existing, clean].slice(0, MAX_REFERENCE_VIDEO_URLS);
}

export default function ExerciseFormModal({
  visible,
  title,
  initialValue,
  existingExercises,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState('');
  const [coachingCues, setCoachingCues] = useState('');
  const [movementType, setMovementType] = useState<ExerciseMovementType>('compound');
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState('');
  const [targetMusclesText, setTargetMusclesText] = useState('');
  const [equipment, setEquipment] = useState('');
  const [referenceVideoUrls, setReferenceVideoUrls] = useState<string[]>([]);
  const [videoDraft, setVideoDraft] = useState('');
  const [videoInlineError, setVideoInlineError] = useState<string | null>(null);
  const [alternativeExerciseIds, setAlternativeExerciseIds] = useState<string[]>([]);
  const [showAlternativesPicker, setShowAlternativesPicker] = useState(false);
  const [alternativesQuery, setAlternativesQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const currentExerciseId = initialValue?.id;

  useEffect(() => {
    if (!visible) return;

    setName(initialValue?.name || '');
    setCoachingCues(initialValue?.coachingCues || '');
    setMovementType(initialValue?.movementType || 'compound');
    setPrimaryMuscleGroup(initialValue?.primaryMuscleGroup || '');
    setTargetMusclesText((initialValue?.targetMuscles || []).join(', '));
    setEquipment(initialValue?.equipment || '');
    setReferenceVideoUrls(initialValue?.referenceVideoUrls || []);
    setAlternativeExerciseIds(initialValue?.alternativeExerciseIds || []);
    setVideoDraft('');
    setVideoInlineError(null);
    setAlternativesQuery('');
    setShowAlternativesPicker(false);
    setSaving(false);
  }, [visible, initialValue]);

  const alternativeSections = useMemo(() => {
    const query = alternativesQuery.trim().toLowerCase();
    const filtered = existingExercises
      .filter((exercise) => exercise.id !== currentExerciseId)
      .filter((exercise) => {
        if (!query) return true;
        return (
          exercise.name.toLowerCase().includes(query) ||
          exercise.primaryMuscleGroup.toLowerCase().includes(query) ||
          exercise.targetMuscles.some((m) => m.toLowerCase().includes(query))
        );
      });
    return groupExercisesByPrimaryMuscle(filtered);
  }, [existingExercises, currentExerciseId, alternativesQuery]);

  const selectedAlternativeExercises = useMemo(
    () =>
      existingExercises
        .filter((exercise) => alternativeExerciseIds.includes(exercise.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [existingExercises, alternativeExerciseIds]
  );

  const toggleAlternative = (exerciseId: string) => {
    setAlternativeExerciseIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId]
    );
  };

  const addVideo = () => {
    const clean = normalizeWhitespace(videoDraft);
    if (!clean) {
      setVideoInlineError('Paste a video link first.');
      return;
    }

    if (referenceVideoUrls.length >= MAX_REFERENCE_VIDEO_URLS) {
      setVideoInlineError(`You can add up to ${MAX_REFERENCE_VIDEO_URLS} links per exercise.`);
      return;
    }

    const duplicate = referenceVideoUrls.some((url) => normalizedUrlKey(url) === normalizedUrlKey(clean));
    if (duplicate) {
      setVideoInlineError('This link is already added. Try a different video URL.');
      return;
    }

    const next = appendReferenceVideo(referenceVideoUrls, clean);
    setReferenceVideoUrls(next);
    setVideoDraft('');
    setVideoInlineError(null);
  };

  const removeVideo = (index: number) => {
    setReferenceVideoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    const cleanName = normalizeWhitespace(name);
    if (!cleanName) return;

    const cleanVideoDraft = normalizeWhitespace(videoDraft);
    if (cleanVideoDraft) {
      const duplicateDraft = referenceVideoUrls.some(
        (url) => normalizedUrlKey(url) === normalizedUrlKey(cleanVideoDraft)
      );
      if (duplicateDraft) {
        setVideoInlineError('This link is already added. Try a different video URL.');
      } else if (referenceVideoUrls.length >= MAX_REFERENCE_VIDEO_URLS) {
        setVideoInlineError(`You can add up to ${MAX_REFERENCE_VIDEO_URLS} links per exercise.`);
      } else {
        setVideoInlineError(null);
      }
    }

    const mergedReferenceVideos = appendReferenceVideo(referenceVideoUrls, videoDraft);
    if (mergedReferenceVideos !== referenceVideoUrls) {
      setReferenceVideoUrls(mergedReferenceVideos);
      setVideoDraft('');
    }

    setSaving(true);
    try {
      await onSave({
        id: initialValue?.id,
        name: cleanName,
        coachingCues,
        movementType,
        primaryMuscleGroup,
        targetMuscles: uniqueByCaseInsensitive(targetMusclesText.split(',')),
        equipment,
        referenceVideoUrls: mergedReferenceVideos,
        alternativeExerciseIds,
      });
      onClose();
    } catch (error: any) {
      Alert.alert('Unable to save exercise', String(error?.message || error || 'unknown_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable style={styles.iconBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Exercise name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Bench Press"
                  placeholderTextColor={C.textMuted}
                  autoFocus
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Coaching cues</Text>
                <TextInput
                  style={[styles.input, styles.multiLine]}
                  value={coachingCues}
                  onChangeText={setCoachingCues}
                  placeholder="Setup, breathing, form notes"
                  placeholderTextColor={C.textMuted}
                  multiline
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Movement type</Text>
                <View style={styles.segmentRow}>
                  {(['compound', 'isolation'] as const).map((type) => {
                    const active = movementType === type;
                    return (
                      <Pressable
                        key={type}
                        style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                        onPress={() => setMovementType(type)}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{type}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Primary muscle group</Text>
                <TextInput
                  style={styles.input}
                  value={primaryMuscleGroup}
                  onChangeText={setPrimaryMuscleGroup}
                  placeholder="e.g. Chest"
                  placeholderTextColor={C.textMuted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Target muscles (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={targetMusclesText}
                  onChangeText={setTargetMusclesText}
                  placeholder="e.g. Upper chest, Triceps"
                  placeholderTextColor={C.textMuted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Equipment (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={equipment}
                  onChangeText={setEquipment}
                  placeholder="e.g. Barbell"
                  placeholderTextColor={C.textMuted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Reference videos ({referenceVideoUrls.length}/{MAX_REFERENCE_VIDEO_URLS})
                </Text>
                <View style={styles.videoRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={videoDraft}
                    onChangeText={(value) => {
                      setVideoDraft(value);
                      if (videoInlineError) setVideoInlineError(null);
                    }}
                    placeholder="Paste a video URL"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable
                    style={[
                      styles.videoAddBtn,
                      referenceVideoUrls.length >= MAX_REFERENCE_VIDEO_URLS && styles.videoAddBtnDisabled,
                    ]}
                    disabled={referenceVideoUrls.length >= MAX_REFERENCE_VIDEO_URLS}
                    onPress={addVideo}
                  >
                    <Ionicons name="add" size={18} color={C.bg} />
                  </Pressable>
                </View>
                {!!videoInlineError && <Text style={styles.videoErrorText}>{videoInlineError}</Text>}
                {referenceVideoUrls.length > 0 && (
                  <View style={styles.chips}>
                    {referenceVideoUrls.map((url, idx) => (
                      <View key={`${url}-${idx}`} style={styles.chip}>
                        <Text numberOfLines={1} style={styles.chipText}>{url}</Text>
                        <Pressable style={styles.iconBtn} onPress={() => removeVideo(idx)}>
                          <Ionicons name="close" size={14} color={C.error} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Alternatives</Text>
                <Pressable style={styles.altDropdownBtn} onPress={() => setShowAlternativesPicker(true)}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.altDropdownText,
                      alternativeExerciseIds.length === 0 && styles.altDropdownPlaceholder,
                    ]}
                  >
                    {alternativeExerciseIds.length > 0
                      ? `${alternativeExerciseIds.length} selected`
                      : 'Select alternatives'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={C.textMuted} />
                </Pressable>
                {selectedAlternativeExercises.length > 0 && (
                  <View style={styles.altChipsWrap}>
                    {selectedAlternativeExercises.map((exercise) => (
                      <View key={exercise.id} style={styles.altChip}>
                        <Text style={styles.altChipText}>{exercise.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && { opacity: 0.85 },
                  (!name.trim() || saving) && styles.saveBtnDisabled,
                ]}
                disabled={!name.trim() || saving}
                onPress={save}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={C.bg} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Exercise</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAlternativesPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAlternativesPicker(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.altPickerSheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Select Alternatives</Text>
              <Pressable style={styles.iconBtn} onPress={() => setShowAlternativesPicker(false)}>
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.altSearchWrap}>
              <Ionicons name="search" size={16} color={C.textMuted} />
              <TextInput
                style={styles.altSearchInput}
                value={alternativesQuery}
                onChangeText={setAlternativesQuery}
                placeholder="Search exercises"
                placeholderTextColor={C.textMuted}
                autoFocus
              />
            </View>

            <SectionList
              sections={alternativeSections}
              keyExtractor={(item) => item.id}
              stickySectionHeadersEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
              renderSectionHeader={({ section }) => (
                <View style={styles.altSectionHeaderWrap}>
                  <Text style={styles.altSectionHeader}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const selected = alternativeExerciseIds.includes(item.id);
                return (
                  <Pressable
                    style={[styles.altOption, selected && styles.altOptionSelected]}
                    onPress={() => toggleAlternative(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.altOptionTitle}>{item.name}</Text>
                      <Text style={styles.altOptionSub}>{item.movementType}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={selected ? C.primary : C.borderLight}
                    />
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>No exercises found</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
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
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 26,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: C.text },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { gap: 14, paddingBottom: 20 },
  field: { gap: 8 },
  label: { fontFamily: 'Outfit_500Medium', fontSize: 13, color: C.textMuted },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    color: C.text,
  },
  multiLine: {
    minHeight: 72,
    maxHeight: 140,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryBg,
  },
  segmentText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: C.textMuted,
    textTransform: 'capitalize',
  },
  segmentTextActive: { color: C.primary },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  videoAddBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
  },
  videoAddBtnDisabled: {
    opacity: 0.5,
  },
  videoErrorText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: C.error,
  },
  chips: { gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipText: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: C.textSecondary,
  },
  altDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
  },
  altDropdownText: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    color: C.text,
  },
  altDropdownPlaceholder: { color: C.textMuted },
  altChipsWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  altChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borderLight,
    backgroundColor: C.surface3,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  altChipText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: C.textSecondary,
  },
  altPickerSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  altSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
  },
  altSearchInput: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    color: C.text,
  },
  altSectionHeaderWrap: {
    backgroundColor: C.surface,
    paddingVertical: 8,
  },
  altSectionHeader: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: C.textSecondary,
  },
  altOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: C.surface2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    gap: 8,
  },
  altOptionSelected: {
    backgroundColor: C.primaryBg,
    borderColor: C.primary + '55',
  },
  altOptionTitle: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: C.text },
  altOptionSub: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: C.textMuted, textTransform: 'capitalize' },
  emptyText: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: C.textMuted,
  },
  saveBtn: {
    marginTop: 6,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: C.bg,
  },
});
