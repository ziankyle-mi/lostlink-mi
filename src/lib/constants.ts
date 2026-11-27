import type {
  AdminLogEntry,
  Broadcast,
  Claim,
  CollegeCode,
  Item,
  Notification,
  Profile,
} from '../types';

export const CAMPUS_BUILDINGS = [
  'Library 2F',
  'Gate 2',
  'DVM Building',
  'Admin Lobby',
  'Science Lab 302',
  '2nd Cafeteria',
  'Grandstand',
  'Chapel steps',
  'Gymnasium',
  'LSB Room 102',
  'Institutional Activity Center (IAC)',
  'The Forum',
  'University Veterinary Teaching Hospital',
  'Hotel de La Salle',
  'Performing Arts Hall',
  'Basic Education Building',
  'Track & Field Oval',
] as const;

export const HOTSPOT_BUILDINGS = [
  'Library 2F',
  'Gate 2',
  'DVM Building',
  '2nd Cafeteria',
] as const;

export const ITEM_CATEGORIES = [
  'IDs, Cards & Wallets',
  'Electronics',
  'Keys & Lanyards',
  'Bags & Tumblers',
  'Eyewear',
] as const;

export const PROGRAMS_BY_COLLEGE: Record<CollegeCode, string[]> = {
  CAST: ['BSCS', 'BSCpE', 'BSBio'],
  CVMAS: ['DVM', 'BSA'],
  CBMA: ['BSBA', 'BSAcc'],
  COED: ['BSEd', 'BEEd'],
};

export interface PersistedState {
  currentUserId: string | null;
  profiles: Profile[];
  items: Item[];
  claims: Claim[];
  notifications: Notification[];
  broadcasts: Broadcast[];
  adminLog: AdminLogEntry[];
}

export const EMPTY_STATE: PersistedState = {
  currentUserId: null,
  profiles: [],
  items: [],
  claims: [],
  notifications: [],
  broadcasts: [],
  adminLog: [],
};

export function initialsOf(name: string, fallback = 'DL'): string {
  const out = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return out || fallback;
}
