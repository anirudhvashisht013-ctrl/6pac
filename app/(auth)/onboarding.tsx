import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { C } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

type Step = 'name' | 'dob' | 'sex' | 'weight' | 'goal';

const GOALS = [
  { id: 'lean', label: 'Lean Body', desc: 'Cut fat, stay athletic', icon: 'flash' },
  { id: 'recomp', label: 'Body Recomp', desc: 'Build muscle, lose fat', icon: 'sync' },
  { id: 'buffed', label: 'Buffed Body', desc: 'Max muscle & strength', icon: 'barbell' },
] as const;

const SEXES = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
] as const;

const STEPS: Step[] = ['name', 'dob', 'sex', 'weight', 'goal'];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState<Step>('name');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<'lean' | 'recomp' | 'buffed'>('recomp');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stepIdx = STEPS.indexOf(step);
  const progress = (stepIdx + 1) / STEPS.length;

  const validateDob = (v: string) => {
    const r = /^\d{4}-\d{2}-\d{2}$/;
    if (!r.test(v)) return false;
    const d = new Date(v);
    return !isNaN(d.getTime()) && d < new Date();
  };

  const formatDob = (text: string) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '-' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6, 8);
    return formatted;
  };

  const goBack = () => {
    setError('');
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const goNext = () => {
    setError('');

    if (step === 'name') {
      if (!fullName.trim()) { setError('Please enter your name'); return; }
      setStep('dob');
      return;
    }

    if (step === 'dob') {
      if (!validateDob(dob)) { setError('Enter a valid date (YYYY-MM-DD)'); return; }
      setStep('sex');
      return;
    }

    if (step === 'sex') {
      setStep('weight');
      return;
    }

    if (step === 'weight') {
      const w = parseFloat(weight);
      if (!weight || Number.isNaN(w) || w < 30 || w > 300) {
        setError('Enter a valid weight (30–300 kg)');
        return;
      }
      setStep('goal');
      return;
    }

    handleFinish();
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');

    try {
      const w = parseFloat(weight);

      if (!fullName.trim()) {
        setError('Please enter your name');
        return;
      }
      if (!validateDob(dob)) {
        setError('Enter a valid date (YYYY-MM-DD)');
        return;
      }
      if (Number.isNaN(w) || w < 30 || w > 300) {
        setError('Enter a valid weight (30–300 kg)');
        return;
      }
      if (!user?.id) {
        setError('Session missing. Please login again.');
        return;
      }

      // ✅ Single source of truth: updateUser writes Firestore + onboardingDone
      await updateUser({
        fullName: fullName.trim(),
        dateOfBirth: dob,
        sex,
        currentWeightKg: w,
        goalType: goal,
      });

      // ✅ Go to tabs home
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          {stepIdx > 0 ? (
            <Pressable onPress={goBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={C.textSecondary} />
            </Pressable>
          ) : <View style={styles.backBtn} />}
          <Text style={styles.stepLabel}>{stepIdx + 1} of {STEPS.length}</Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.content}>
          {step === 'name' && (
            <>
              <Text style={styles.question}>What's your name?</Text>
              <Text style={styles.hint}>We'll personalize your experience</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full name"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>
            </>
          )}

          {step === 'dob' && (
            <>
              <Text style={styles.question}>When were you born?</Text>
              <Text style={styles.hint}>Used to calculate fitness metrics</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={dob}
                  onChangeText={(t) => setDob(formatDob(t))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  autoFocus
                />
              </View>
            </>
          )}

          {step === 'sex' && (
            <>
              <Text style={styles.question}>Biological sex</Text>
              <Text style={styles.hint}>Used for accurate calorie calculations</Text>
              <View style={styles.optionGrid}>
                {SEXES.map(s => (
                  <Pressable
                    key={s.id}
                    style={[styles.optionBtn, sex === s.id && styles.optionBtnSelected]}
                    onPress={() => setSex(s.id)}
                  >
                    <Text style={[styles.optionText, sex === s.id && styles.optionTextSelected]}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {step === 'weight' && (
            <>
              <Text style={styles.question}>Current body weight</Text>
              <Text style={styles.hint}>In kilograms</Text>
              <View style={styles.weightInputRow}>
                <View style={[styles.inputWrap, { flex: 1 }]}>
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="e.g. 75.0"
                    placeholderTextColor={C.textMuted}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>
                <View style={styles.unitBadge}>
                  <Text style={styles.unitText}>kg</Text>
                </View>
              </View>
            </>
          )}

          {step === 'goal' && (
            <>
              <Text style={styles.question}>What's your goal?</Text>
              <Text style={styles.hint}>This guides your weekly plan</Text>
              <View style={styles.goalList}>
                {GOALS.map(g => (
                  <Pressable
                    key={g.id}
                    style={[styles.goalCard, goal === g.id && styles.goalCardSelected]}
                    onPress={() => setGoal(g.id)}
                  >
                    <View style={[styles.goalIcon, goal === g.id && styles.goalIconSelected]}>
                      <Ionicons name={g.icon as any} size={22} color={goal === g.id ? C.bg : C.textSecondary} />
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={[styles.goalLabel, goal === g.id && styles.goalLabelSelected]}>
                        {g.label}
                      </Text>
                      <Text style={styles.goalDesc}>{g.desc}</Text>
                    </View>
                    {goal === g.id && (
                      <Ionicons name="checkmark-circle" size={22} color={C.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={C.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.nextBtn, { opacity: pressed || loading ? 0.85 : 1 }]}
            onPress={goNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === 'goal' ? "Let's go!" : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={C.bg} />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: C.textMuted,
  },
  progressBar: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 2,
    marginBottom: 40,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    gap: 16,
  },
  question: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 26,
    color: C.text,
    lineHeight: 34,
  },
  hint: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    color: C.textMuted,
    marginTop: -8,
    marginBottom: 8,
  },
  inputWrap: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
  },
  input: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 18,
    color: C.text,
  },
  optionGrid: {
    gap: 10,
  },
  optionBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface2,
  },
  optionBtnSelected: {
    borderColor: C.primary,
    backgroundColor: C.primaryBg,
  },
  optionText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
    color: C.textSecondary,
  },
  optionTextSelected: {
    color: C.primary,
  },
  weightInputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  unitBadge: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: C.textMuted,
  },
  goalList: {
    gap: 10,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
  },
  goalCardSelected: {
    borderColor: C.primary,
    backgroundColor: C.primaryBg,
  },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconSelected: {
    backgroundColor: C.primary,
  },
  goalInfo: {
    flex: 1,
    gap: 2,
  },
  goalLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: C.textSecondary,
  },
  goalLabelSelected: {
    color: C.text,
  },
  goalDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: C.textMuted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.errorBg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.error + '40',
  },
  errorText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: C.error,
    flex: 1,
  },
  nextBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  nextBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: C.bg,
  },
});