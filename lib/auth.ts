import * as Crypto from 'expo-crypto';
import { usersRepo, sessionRepo } from './storage';
import type { User } from './types';

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
}

export async function signUp(email: string, password: string): Promise<User> {
  const existing = await usersRepo.getByEmail(email);
  if (existing) throw new Error('Email already in use');

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  const user: User = {
    id,
    email: email.trim().toLowerCase(),
    passwordHash,
    salt,
    fullName: '',
    dateOfBirth: '',
    sex: 'male',
    currentWeightKg: 0,
    goalType: 'recomp',
    createdAt: now,
  };

  await usersRepo.save(user);
  const token = randomHex(32);
  await sessionRepo.save(id, token);
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const user = await usersRepo.getByEmail(email);
  if (!user) throw new Error('Invalid email or password');

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('Invalid email or password');

  const token = randomHex(32);
  await sessionRepo.save(user.id, token);
  return user;
}

export async function logout(): Promise<void> {
  await sessionRepo.clear();
}

export async function restoreSession(): Promise<User | null> {
  const token = await sessionRepo.getToken();
  const userId = await sessionRepo.getUserId();
  if (!token || !userId) return null;
  return usersRepo.getById(userId);
}

export function isProfileComplete(user: User): boolean {
  return !!(user.fullName && user.dateOfBirth && user.currentWeightKg > 0);
}
