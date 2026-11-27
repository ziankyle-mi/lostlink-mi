import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AccountType,
  AdminLogEntry,
  Broadcast,
  BroadcastTier,
  Claim,
  CollegeCode,
  Item,
  ItemType,
  Notification,
  Profile,
  UserRole,
} from '../types';
import { supabase } from './supabase';
import {
  ITEM_PHOTOS_BUCKET,
  fetchPortalSnapshot,
  fetchPublicSnapshot,
  mapAdminLog,
  mapBroadcast,
  mapClaim,
  mapItem,
  mapNotification,
  mapProfile,
  signItemImages,
  uploadItemPhotos,
  type AdminLogRow,
  type BroadcastRow,
  type ClaimRow,
  type ItemRow,
  type NotificationRow,
  type ProfileRow,
} from './supabaseData';
import {
  CAMPUS_BUILDINGS,
  EMPTY_STATE,
  HOTSPOT_BUILDINGS,
  ITEM_CATEGORIES,
  PROGRAMS_BY_COLLEGE,
  type PersistedState,
} from './constants';
import { generateTempPassword, isDlsauEmail, isStudentId } from './validation';

export { CAMPUS_BUILDINGS, HOTSPOT_BUILDINGS, ITEM_CATEGORIES, PROGRAMS_BY_COLLEGE };

const STORAGE_KEY = 'lostlink_dlsau_v1';
const EMPTY_IMAGES: string[] = [];

const PROGRAM_TO_COLLEGE = new Map<string, CollegeCode>(
  Object.entries(PROGRAMS_BY_COLLEGE).flatMap(([college, programs]) =>
    programs.map((program) => [program, college as CollegeCode] as const)
  )
);

function inferCollege(program: string): CollegeCode {
  return PROGRAM_TO_COLLEGE.get(program) ?? 'CAST';
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeLogEntry(
  adminId: string,
  action: string,
  targetLabel: string,
  detail: string
): AdminLogEntry {
  return {
    id: makeId('log'),
    adminId,
    action,
    targetLabel,
    detail,
    createdAt: new Date().toISOString(),
  };
}

function makeNotification(userId: string, message: string): Notification {
  return {
    id: makeId('notif'),
    userId,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

function withDemoMeta(
  prev: PersistedState,
  adminId: string,
  log: [action: string, target: string, detail: string],
  notif?: [userId: string, message: string]
): Partial<PersistedState> {
  if (supabase) return {};
  return {
    ...(notif ? { notifications: [makeNotification(notif[0], notif[1]), ...prev.notifications] } : {}),
    adminLog: [makeLogEntry(adminId, log[0], log[1], log[2]), ...prev.adminLog],
  };
}

function loadDemoState(fallback: PersistedState): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      currentUserId: typeof parsed.currentUserId === 'string' ? parsed.currentUserId : null,
      profiles:
        Array.isArray(parsed.profiles) && parsed.profiles.length > 0
          ? parsed.profiles
          : fallback.profiles,
      items: Array.isArray(parsed.items) ? parsed.items : fallback.items,
      claims: Array.isArray(parsed.claims) ? parsed.claims : fallback.claims,
      notifications: Array.isArray(parsed.notifications)
        ? parsed.notifications
        : fallback.notifications,
      broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : fallback.broadcasts,
      adminLog: Array.isArray(parsed.adminLog) ? parsed.adminLog : fallback.adminLog,
    };
  } catch {
    return fallback;
  }
}

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  accountType: AccountType;
  program: string;
  studentId: string | null;
  yearLevel: string | null;
}

interface CreateItemInput {
  type: ItemType;
  name: string;
  category: string;
  location: string;
  description: string;
  images: string[];
  hidePhoto?: boolean;
}

interface LostLinkContextValue extends PersistedState {
  currentUser: Profile | null;
  authReady: boolean;
  isLiveBackend: boolean;
  syncError: string | null;
  clearSyncError: () => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: Profile }>;
  signInDemoRole: (role: 'student' | 'admin') => Profile | undefined;
  registerAccount: (
    input: RegisterInput
  ) => Promise<{ ok: boolean; error?: string; needsEmailConfirm?: boolean }>;
  completePasswordReset: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  createItem: (input: CreateItemInput) => Promise<{ ok: boolean; error?: string; item?: Item }>;
  deleteItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  submitClaim: (itemId: string, proof: string) => Promise<{ ok: boolean; error?: string }>;
  submitSighting: (itemId: string, note: string) => Promise<{ ok: boolean; error?: string }>;
  withdrawClaim: (claimId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  confirmIntake: (itemId: string) => void;
  rejectIntake: (itemId: string, reason: string) => void;
  toggleItemPhotoShield: (itemId: string) => void;
  verifyClaim: (claimId: string, decision: 'verified' | 'denied', reason?: string) => void;
  extendCustody: (itemId: string) => void;
  markDonationTurnover: (itemId: string) => void;
  publishBroadcast: (tier: BroadcastTier, message: string) => void;
  removeBroadcast: (id: string) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  toggleUserActive: (userId: string) => void;
  issueTempPassword: (
    userId: string,
    options?: { newPassword?: string; requireReset?: boolean }
  ) => Promise<{ ok: boolean; tempPassword?: string; error?: string }>;
}

const LostLinkContext = createContext<LostLinkContextValue | null>(null);

export function LostLinkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(EMPTY_STATE);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const hydratedUserRef = useRef<string | null>(null);
  const inflightHydrateRef = useRef<{ userId: string; promise: Promise<Profile | null> } | null>(null);
  const clearSyncError = useCallback(() => setSyncError(null), []);

  const runLiveTask = useCallback((task: () => Promise<void>) => {
    void task().catch((err) => {
      console.error('[LostLink] Live sync error:', err);
      setSyncError(err instanceof Error ? err.message : 'Could not sync changes with Supabase.');
    });
  }, []);

  const currentUser = useMemo(
    () => state.profiles.find((p) => p.id === state.currentUserId) ?? null,
    [state.profiles, state.currentUserId]
  );

  // Keep refs in sync so action callbacks stay referentially stable and never read stale state
  const stateRef = useRef(state);
  stateRef.current = state;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const hydrateUser = useCallback(async (userId: string, force = false): Promise<Profile | null> => {
    if (!supabase) return null;
    if (!force) {
      if (inflightHydrateRef.current?.userId === userId) {
        return inflightHydrateRef.current.promise;
      }
      if (hydratedUserRef.current === userId) {
        return stateRef.current.profiles.find((p) => p.id === userId) ?? null;
      }
    }
    hydratedUserRef.current = userId;
    const promise = (async (): Promise<Profile | null> => {
      try {
        const { data: profileRow, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (hydratedUserRef.current !== userId) return null;
        if (error || !profileRow) {
          hydratedUserRef.current = null;
          setState(EMPTY_STATE);
          return null;
        }
        const profile = mapProfile(profileRow as ProfileRow);
        if (!profile.active) {
          hydratedUserRef.current = null;
          await supabase.auth.signOut();
          setState(EMPTY_STATE);
          return null;
        }
        const snapshot = await fetchPortalSnapshot(supabase, profile);
        if (hydratedUserRef.current !== userId) return null;
        setState({ currentUserId: profile.id, ...snapshot });
        return profile;
      } catch {
        if (hydratedUserRef.current === userId) hydratedUserRef.current = null;
        return null;
      }
    })();
    inflightHydrateRef.current = { userId, promise };
    void promise.finally(() => {
      if (inflightHydrateRef.current?.promise === promise) {
        inflightHydrateRef.current = null;
      }
    });
    return promise;
  }, []);

  const hydratePublic = useCallback(async () => {
    if (!supabase) return;
    try {
      const pub = await fetchPublicSnapshot(supabase);
      // Only apply if still signed out so a racing sign-in is never overwritten.
      if (hydratedUserRef.current !== null) return;
      setState({ ...EMPTY_STATE, items: pub.items, broadcasts: pub.broadcasts });
    } catch {
      if (hydratedUserRef.current === null) setState(EMPTY_STATE);
    }
  }, []);

  // Offline demo bootstrap: lazy-loads seedData only when Supabase env vars are absent.
  useEffect(() => {
    if (supabase) return;
    let active = true;
    void import('./seedData')
      .then(({ INITIAL_DEMO_STATE }) => {
        if (active) setState(loadDemoState(INITIAL_DEMO_STATE));
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Live Supabase auth session bootstrap + listener
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;
        if (session?.user) {
          await hydrateUser(session.user.id);
        } else {
          hydratedUserRef.current = null;
          await hydratePublic();
        }
      } catch {
        if (active) {
          hydratedUserRef.current = null;
          setState(EMPTY_STATE);
        }
      } finally {
        if (active) setAuthReady(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Initial session is already handled by getSession() above; skip duplicate fetch.
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        hydratedUserRef.current = null;
        void hydratePublic().finally(() => {
          if (active) setAuthReady(true);
        });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void hydrateUser(session.user.id, event === 'USER_UPDATED').finally(() => {
          if (active) setAuthReady(true);
        });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser, hydratePublic]);

  // Persist demo state to localStorage ONLY when offline and hydrated (never write live DB data locally)
  useEffect(() => {
    if (supabase || !authReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota warnings in demo mode
    }
  }, [state, authReady]);

  // Live Realtime notifications & broadcasts subscription
  useEffect(() => {
    if (!supabase || !currentUser?.id) return;
    const client = supabase;
    const uid = currentUser.id;
    let active = true;

    const channel = client
      .channel(`portal-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          if (!active) return;
          const next = mapNotification(payload.new as NotificationRow);
          setState((prev) =>
            prev.notifications.some((n) => n.id === next.id)
              ? prev
              : { ...prev, notifications: [next, ...prev.notifications] }
          );
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, async () => {
        const { data } = await client
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (active && data) {
          setState((prev) => ({
            ...prev,
            broadcasts: (data as BroadcastRow[]).map(mapBroadcast),
          }));
        }
      })
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const appendLiveAdminLog = useCallback(
    async (action: string, targetLabel: string, detail: string) => {
      const admin = currentUserRef.current;
      if (!supabase || !admin || admin.role !== 'admin') return;
      const { data } = await supabase
        .from('admin_log')
        .insert({
          admin_id: admin.id,
          action,
          target_label: targetLabel,
          detail,
        })
        .select()
        .single();
      if (data) {
        const entry = mapAdminLog(data as AdminLogRow);
        setState((prev) => ({ ...prev, adminLog: [entry, ...prev.adminLog] }));
      }
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const clean = email.trim().toLowerCase();
      if (!isDlsauEmail(clean)) {
        return { ok: false, error: 'Use a valid @dlsau.edu.ph email address.' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'Password must be at least 6 characters.' };
      }

      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: clean, password });
        if (error || !data.user) {
          return { ok: false, error: 'Invalid DLSAU email or password.' };
        }
        const profile = await hydrateUser(data.user.id);
        if (!profile) {
          return { ok: false, error: 'Account is suspended or missing a campus profile. Contact LSB Room 102.' };
        }
        return { ok: true, user: profile };
      }

      const existing = stateRef.current.profiles.find((p) => p.email.toLowerCase() === clean);
      if (existing && !existing.active) {
        return { ok: false, error: 'This DLSAU account is suspended. Contact LSB Room 102.' };
      }

      const user: Profile = existing ?? {
        id: makeId('user'),
        fullName: clean.split('@')[0].replace(/[._]/g, ' '),
        email: clean,
        role: clean.includes('admin') || clean.includes('security') ? 'admin' : 'user',
        accountType: 'student',
        active: true,
        college: 'CAST',
        program: 'BSCS',
        studentId: '2024-00-010001',
        yearLevel: '3rd Year',
        mustChangePassword: false,
      };

      setState((prev) => ({
        ...prev,
        currentUserId: user.id,
        profiles: existing ? prev.profiles : [user, ...prev.profiles],
      }));
      return { ok: true, user };
    },
    [hydrateUser]
  );

  const signInDemoRole = useCallback((role: 'student' | 'admin') => {
    const targetId = role === 'admin' ? 'user-admin' : 'user-renee';
    const profiles = stateRef.current.profiles;
    const user = profiles.find((p) => p.id === targetId) ?? profiles[0];
    if (user) setState((prev) => ({ ...prev, currentUserId: user.id }));
    return user;
  }, []);

  const registerAccount = useCallback(
    async (input: RegisterInput) => {
      const email = input.email.trim().toLowerCase();
      if (!isDlsauEmail(email)) {
        return { ok: false, error: 'Only @dlsau.edu.ph accounts are allowed.' };
      }
      if (input.password.length < 8) {
        return { ok: false, error: 'Password must be at least 8 characters.' };
      }
      if (input.accountType === 'student' && (!input.studentId || !isStudentId(input.studentId))) {
        return { ok: false, error: 'Student ID must match YYYY-00-XXXXXX.' };
      }

      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: input.password,
          options: {
            data: {
              full_name: input.fullName.trim(),
              account_type: input.accountType,
              college: inferCollege(input.program),
              program: input.program,
              student_id: input.accountType === 'student' ? input.studentId?.trim() : null,
              year_level: input.accountType === 'student' ? input.yearLevel : null,
            },
          },
        });
        if (error) return { ok: false, error: error.message };
        if (!data.session || !data.user) {
          return { ok: true, needsEmailConfirm: true };
        }
        await hydrateUser(data.user.id);
        return { ok: true };
      }

      if (stateRef.current.profiles.some((p) => p.email.toLowerCase() === email)) {
        return { ok: false, error: 'An account with this @dlsau.edu.ph email already exists.' };
      }

      const user: Profile = {
        id: makeId('user'),
        fullName: input.fullName.trim(),
        email,
        role: 'user',
        accountType: input.accountType,
        active: true,
        college: inferCollege(input.program),
        program: input.program,
        studentId: input.accountType === 'student' ? input.studentId : null,
        yearLevel: input.accountType === 'student' ? input.yearLevel : null,
        mustChangePassword: false,
      };

      setState((prev) => ({
        ...prev,
        currentUserId: user.id,
        profiles: [user, ...prev.profiles],
      }));
      return { ok: true };
    },
    [hydrateUser]
  );

  const signOut = useCallback(async () => {
    setSyncError(null);
    if (supabase) {
      hydratedUserRef.current = null;
      inflightHydrateRef.current = null;
      setState((prev) => ({
        ...EMPTY_STATE,
        items: prev.items.filter((i) => i.status === 'approved').map((i) => (i.hidePhoto ? { ...i, images: [] } : i)),
        broadcasts: prev.broadcasts.filter((b) => b.active),
      }));
      try {
        await supabase.auth.signOut();
      } catch {
        // Local session state is already cleared
      }
      return;
    }
    setState((prev) => ({ ...prev, currentUserId: null }));
  }, []);

  const completePasswordReset = useCallback(async (newPassword: string) => {
    const user = currentUserRef.current;
    if (!user) return { ok: false, error: 'Please sign in first.' };
    if (newPassword.length < 8) {
      return { ok: false, error: 'New password must be at least 8 characters.' };
    }
    const notifMsg = 'Your DLSAU campus portal password has been updated.';
    if (supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
      if (profErr) return { ok: false, error: profErr.message };
      await supabase.from('notifications').insert({ user_id: user.id, message: notifMsg });
    }
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === user.id ? { ...p, mustChangePassword: false } : p
      ),
      notifications: supabase
        ? prev.notifications
        : [makeNotification(user.id, notifMsg), ...prev.notifications],
    }));
    return { ok: true };
  }, []);

  const createItem = useCallback(async (input: CreateItemInput) => {
    const user = currentUserRef.current;
    if (!user) return { ok: false, error: 'Please sign in first.' };
    if (input.description.trim().length < 10) {
      return { ok: false, error: 'Description must be at least 10 characters.' };
    }
    if (input.type === 'found' && input.images.length === 0) {
      return { ok: false, error: 'Upload 1 to 3 photos for found items.' };
    }

    const hidePhoto = Boolean(input.hidePhoto) || input.category === 'IDs, Cards & Wallets';
    const refCode = `LL-${Math.floor(10000 + Math.random() * 90000)}`;
    const status = input.type === 'found' ? 'pending' : 'approved';
    const custodyNote =
      input.type === 'found'
        ? 'Pending physical drop-off at LSB Room 102'
        : 'Reported by owner · Awaiting turn-in';
    const notifMsg =
      input.type === 'found'
        ? `Report ${refCode} logged. Drop the item off at LSB Room 102 with your reference tag.`
        : `Lost report ${refCode} published to the campus feed.`;

    if (supabase) {
      try {
        const uploadedPaths = await uploadItemPhotos(supabase, user.id, input.images);
        const { data: itemRow, error } = await supabase
          .from('items')
          .insert({
            reference_code: refCode,
            type: input.type,
            status,
            name: input.name.trim(),
            category: input.category,
            location: input.location,
            event_date: new Date().toISOString().slice(0, 10),
            description: input.description.trim(),
            images: uploadedPaths,
            hide_photo: hidePhoto,
            custody_note: custodyNote,
            reporter_id: user.id,
          })
          .select()
          .single();
        if (error || !itemRow) {
          const orphanPaths = uploadedPaths.filter((p) => p.startsWith(`${user.id}/`));
          if (orphanPaths.length > 0) {
            void supabase.storage.from(ITEM_PHOTOS_BUCKET).remove(orphanPaths);
          }
          return { ok: false, error: error?.message ?? 'Could not save report.' };
        }
        await supabase.from('notifications').insert({ user_id: user.id, message: notifMsg });
        const [signedItem] = await signItemImages(
          supabase,
          [mapItem(itemRow as ItemRow)],
          user.role === 'admin'
        );
        setState((prev) => ({ ...prev, items: [signedItem, ...prev.items] }));
        return { ok: true, item: signedItem };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Upload failed.' };
      }
    }

    const item: Item = {
      id: makeId('item'),
      referenceCode: refCode,
      type: input.type,
      status,
      name: input.name.trim(),
      category: input.category,
      location: input.location,
      eventDate: new Date().toISOString().slice(0, 10),
      description: input.description.trim(),
      images: input.images.slice(0, 3),
      hidePhoto,
      custodyNote,
      reporterId: user.id,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      items: [item, ...prev.items],
      notifications: [makeNotification(user.id, notifMsg), ...prev.notifications],
    }));
    return { ok: true, item };
  }, []);

  const deleteItem = useCallback(
    async (itemId: string) => {
      const user = currentUserRef.current;
      if (!user) return { ok: false, error: 'Please sign in first.' };
      const target = stateRef.current.items.find((i) => i.id === itemId);
      if (!target) return { ok: false, error: 'Item not found.' };
      const isAdminUser = user.role === 'admin';
      const isOwnerPending = target.reporterId === user.id && target.status === 'pending';
      if (!isAdminUser && !isOwnerPending) {
        return { ok: false, error: 'You can only delete your own pending reports.' };
      }

      if (supabase) {
        const { error } = await supabase.from('items').delete().eq('id', itemId);
        if (error) return { ok: false, error: error.message };
      }

      const detail = `Deleted ${target.name}`;
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== itemId),
        claims: prev.claims.filter((c) => c.itemId !== itemId),
        ...(isAdminUser ? withDemoMeta(prev, user.id, ['delete_item', target.referenceCode, detail]) : {}),
      }));

      if (supabase && isAdminUser) {
        await appendLiveAdminLog('delete_item', target.referenceCode, detail);
      }
      return { ok: true };
    },
    [appendLiveAdminLog]
  );

  const submitClaim = useCallback(async (itemId: string, proof: string) => {
    const user = currentUserRef.current;
    if (!user) return { ok: false, error: 'Please sign in first.' };
    const cleanProof = proof.trim();
    if (cleanProof.length < 20) {
      return { ok: false, error: 'Write at least 20 characters of physical proof.' };
    }
    const { items, claims } = stateRef.current;
    const item = items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: 'Item not found.' };
    if (item.type !== 'found' || item.status !== 'approved') {
      return { ok: false, error: 'Only approved found items can be claimed.' };
    }
    if (item.reporterId === user.id) {
      return { ok: false, error: 'You cannot submit a claim on an item you reported.' };
    }
    const duplicate = claims.some(
      (c) => c.itemId === itemId && c.claimantId === user.id && c.status === 'pending'
    );
    if (duplicate) {
      return { ok: false, error: 'You already have a pending claim on this item.' };
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('claims')
        .insert({
          item_id: itemId,
          claimant_id: user.id,
          proof_description: cleanProof,
          status: 'pending',
        })
        .select()
        .single();
      if (error || !data) {
        const msg =
          error?.code === '23505'
            ? 'You already have a pending claim on this item.'
            : error?.message ?? 'Could not submit claim.';
        return { ok: false, error: msg };
      }
      setState((prev) => ({ ...prev, claims: [mapClaim(data as ClaimRow), ...prev.claims] }));
      return { ok: true };
    }

    const claim: Claim = {
      id: makeId('claim'),
      itemId,
      claimantId: user.id,
      proofDescription: cleanProof,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, claims: [claim, ...prev.claims] }));
    return { ok: true };
  }, []);

  const submitSighting = useCallback(async (itemId: string, note: string) => {
    const user = currentUserRef.current;
    if (!user) return { ok: false, error: 'Please sign in first.' };
    const cleanNote = note.trim();
    if (cleanNote.length < 20) {
      return { ok: false, error: 'Write at least 20 characters describing the sighting.' };
    }
    const item = stateRef.current.items.find((i) => i.id === itemId);
    if (!item || item.type !== 'lost' || item.status !== 'approved') {
      return { ok: false, error: 'Sightings can only be sent on active lost-item alerts.' };
    }
    if (item.reporterId === user.id) {
      return { ok: false, error: 'You cannot send a sighting on your own lost report.' };
    }

    if (supabase) {
      const { error } = await supabase.from('sightings').insert({
        item_id: itemId,
        sender_id: user.id,
        note: cleanNote,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    const ownerNotif = makeNotification(
      item.reporterId,
      `Sighting on ${item.referenceCode} (${item.name}) from ${user.fullName}: "${cleanNote}"`
    );
    const senderNotif = makeNotification(
      user.id,
      `Your sighting for ${item.referenceCode} (${item.name}) was sent to the owner.`
    );
    setState((prev) => ({
      ...prev,
      notifications: [ownerNotif, senderNotif, ...prev.notifications],
    }));
    return { ok: true };
  }, []);

  const withdrawClaim = useCallback((claimId: string) => {
    const user = currentUserRef.current;
    if (!user) return;
    const match = stateRef.current.claims.some(
      (c) => c.id === claimId && c.claimantId === user.id && c.status === 'pending'
    );
    if (!match) return;

    setState((prev) => ({
      ...prev,
      claims: prev.claims.map((c) =>
        c.id === claimId && c.claimantId === prev.currentUserId && c.status === 'pending'
          ? { ...c, status: 'withdrawn' }
          : c
      ),
    }));
    if (supabase) {
      const client = supabase;
      runLiveTask(async () => {
        await client
          .from('claims')
          .update({ status: 'withdrawn' })
          .eq('id', claimId)
          .eq('claimant_id', user.id)
          .eq('status', 'pending');
      });
    }
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    const user = currentUserRef.current;
    const target = stateRef.current.notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    if (supabase && user) {
      const client = supabase;
      runLiveTask(async () => {
        await client
          .from('notifications')
          .update({ read: true })
          .eq('id', id)
          .eq('user_id', user.id);
      });
    }
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    const user = currentUserRef.current;
    if (!user) return;
    const hasUnread = stateRef.current.notifications.some(
      (n) => n.userId === user.id && !n.read
    );
    if (!hasUnread) return;

    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.userId === prev.currentUserId ? { ...n, read: true } : n
      ),
    }));
    if (supabase) {
      const client = supabase;
      runLiveTask(async () => {
        await client
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false);
      });
    }
  }, []);

  const confirmIntake = useCallback(
    (itemId: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin') return;
      const target = stateRef.current.items.find((i) => i.id === itemId);
      if (!target) return;

      const note = 'LSB Room 102 · Vault Custody';
      const notifMsg = `Security confirmed physical custody for ${target.referenceCode} at LSB Room 102.`;
      const detail = `Confirmed physical custody for ${target.name} at LSB Room 102.`;

      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, status: 'approved', custodyNote: note } : i
        ),
        ...withDemoMeta(prev, admin.id, ['confirm_intake', target.referenceCode, detail], [
          target.reporterId,
          notifMsg,
        ]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client
            .from('items')
            .update({ status: 'approved', custody_note: note })
            .eq('id', itemId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await client.from('notifications').insert({ user_id: target.reporterId, message: notifMsg });
          await appendLiveAdminLog('confirm_intake', target.referenceCode, detail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const rejectIntake = useCallback(
    (itemId: string, reason: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin') return;
      const cleanReason = reason.trim();
      if (!cleanReason) return;
      const target = stateRef.current.items.find((i) => i.id === itemId);
      if (!target) return;

      const custodyNote = `Rejected: ${cleanReason}`;
      const notifMsg = `Report ${target.referenceCode} was rejected by Security Office: ${cleanReason}`;

      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? { ...i, status: 'rejected', rejectReason: cleanReason, custodyNote }
            : i
        ),
        ...withDemoMeta(prev, admin.id, ['reject_intake', target.referenceCode, cleanReason], [
          target.reporterId,
          notifMsg,
        ]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client
            .from('items')
            .update({ status: 'rejected', reject_reason: cleanReason, custody_note: custodyNote })
            .eq('id', itemId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await client.from('notifications').insert({ user_id: target.reporterId, message: notifMsg });
          await appendLiveAdminLog('reject_intake', target.referenceCode, cleanReason);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const toggleItemPhotoShield = useCallback(
    (itemId: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin') return;
      const target = stateRef.current.items.find((i) => i.id === itemId);
      if (!target) return;
      const nextShield = !target.hidePhoto;
      const detail = nextShield
        ? 'Enabled ID Photo Shield (DO Admin only).'
        : 'Disabled ID Photo Shield.';

      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === itemId ? { ...i, hidePhoto: nextShield } : i)),
        ...withDemoMeta(prev, admin.id, ['toggle_photo_shield', target.referenceCode, detail]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client
            .from('items')
            .update({ hide_photo: nextShield })
            .eq('id', itemId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await appendLiveAdminLog('toggle_photo_shield', target.referenceCode, detail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const verifyClaim = useCallback(
    (claimId: string, decision: 'verified' | 'denied', reason?: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin') return;
      const cleanReason = reason?.trim() || null;
      const claim = stateRef.current.claims.find((c) => c.id === claimId);
      if (!claim) return;
      const item = stateRef.current.items.find((i) => i.id === claim.itemId);
      const refCode = item?.referenceCode ?? 'item';
      const notifMsg =
        decision === 'verified'
          ? `Claim verified for ${refCode}. Bring your DLSAU ID to LSB Room 102 for pickup.`
          : cleanReason
            ? `Claim denied for ${refCode}: ${cleanReason}`
            : `Claim denied for ${refCode}. Contact LSB Room 102 if you have additional proof.`;
      const logAction = decision === 'verified' ? 'verify_claim' : 'deny_claim';
      const logDetail =
        decision === 'verified'
          ? `Verified claim and released ${item?.name ?? 'item'}.`
          : cleanReason
            ? `Denied claim: ${cleanReason}`
            : 'Denied claim for insufficient ownership proof.';

      setState((prev) => ({
        ...prev,
        claims: prev.claims.map((c) => {
          if (c.id === claimId) {
            return { ...c, status: decision, denialReason: decision === 'denied' ? cleanReason : null };
          }
          if (decision === 'verified' && c.itemId === claim.itemId && c.status === 'pending') {
            return { ...c, status: 'denied', denialReason: 'Item verified and released to another claimant.' };
          }
          return c;
        }),
        items:
          decision === 'verified'
            ? prev.items.map((i) =>
                i.id === claim.itemId ? { ...i, status: 'resolved', custodyNote: 'Released to owner' } : i
              )
            : prev.items,
        ...withDemoMeta(prev, admin.id, [logAction, refCode, logDetail], [claim.claimantId, notifMsg]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client
            .from('claims')
            .update({ status: decision, denial_reason: decision === 'denied' ? cleanReason : null })
            .eq('id', claimId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          if (decision === 'verified') {
            await client
              .from('claims')
              .update({
                status: 'denied',
                denial_reason: 'Item verified and released to another claimant.',
              })
              .eq('item_id', claim.itemId)
              .eq('status', 'pending')
              .neq('id', claimId);
            await client
              .from('items')
              .update({ status: 'resolved', custody_note: 'Released to owner' })
              .eq('id', claim.itemId);
          }
          await client.from('notifications').insert({ user_id: claim.claimantId, message: notifMsg });
          await appendLiveAdminLog(logAction, refCode, logDetail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const extendCustody = useCallback(
    (itemId: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin') return;
      const target = stateRef.current.items.find((i) => i.id === itemId);
      if (!target || target.type !== 'found' || target.status !== 'approved') return;

      const baseMs = Math.max(
        Date.now(),
        target.custodyExtendedUntil ? Date.parse(target.custodyExtendedUntil) || 0 : 0
      );
      const nextUntil = new Date(baseMs + 14 * 86_400_000).toISOString();
      const untilDate = nextUntil.slice(0, 10);
      const custodyNote = `LSB Room 102 · Hold extended until ${untilDate}`;
      const detail = `Extended hold +14 days (until ${untilDate}).`;

      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, custodyExtendedUntil: nextUntil, custodyNote } : i
        ),
        ...withDemoMeta(prev, admin.id, ['extend_custody', target.referenceCode, detail]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client
            .from('items')
            .update({ custody_extended_until: nextUntil, custody_note: custodyNote })
            .eq('id', itemId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await appendLiveAdminLog('extend_custody', target.referenceCode, detail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const markDonationTurnover = useCallback(
    (itemId: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin') return;
      const target = stateRef.current.items.find((i) => i.id === itemId);
      if (!target || target.type !== 'found' || target.status !== 'approved') return;
      const detail = `Closed ${target.name} as campus donation turnover.`;

      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? { ...i, status: 'resolved', donationTurnover: true, custodyNote: 'Turned over for campus donation' }
            : i
        ),
        claims: prev.claims.map((c) =>
          c.itemId === itemId && c.status === 'pending'
            ? { ...c, status: 'denied', denialReason: 'Item turned over for campus donation.' }
            : c
        ),
        ...withDemoMeta(prev, admin.id, ['donation_turnover', target.referenceCode, detail]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client
            .from('items')
            .update({
              status: 'resolved',
              donation_turnover: true,
              custody_note: 'Turned over for campus donation',
            })
            .eq('id', itemId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await client
            .from('claims')
            .update({ status: 'denied', denial_reason: 'Item turned over for campus donation.' })
            .eq('item_id', itemId)
            .eq('status', 'pending');
          await appendLiveAdminLog('donation_turnover', target.referenceCode, detail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const publishBroadcast = useCallback(
    (tier: BroadcastTier, message: string) => {
      const admin = currentUserRef.current;
      const clean = message.trim();
      if (admin?.role !== 'admin' || !clean) return;

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { data } = await client
            .from('broadcasts')
            .insert({ tier, message: clean, active: true, created_by: admin.id })
            .select()
            .single();
          if (data) {
            const next = mapBroadcast(data as BroadcastRow);
            setState((prev) => ({
              ...prev,
              broadcasts: prev.broadcasts.some((b) => b.id === next.id)
                ? prev.broadcasts
                : [next, ...prev.broadcasts],
            }));
            await appendLiveAdminLog('publish_broadcast', tier, clean);
          }
        });
        return;
      }

      const next: Broadcast = {
        id: makeId('bc'),
        tier,
        message: clean,
        active: true,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        broadcasts: [next, ...prev.broadcasts],
        ...withDemoMeta(prev, admin.id, ['publish_broadcast', tier, clean]),
      }));
    },
    [appendLiveAdminLog]
  );

  const removeBroadcast = useCallback(
    (id: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin') return;
      const target = stateRef.current.broadcasts.find((b) => b.id === id);
      if (!target) return;
      const detail = `Removed: ${target.message}`;

      setState((prev) => ({
        ...prev,
        broadcasts: prev.broadcasts.filter((b) => b.id !== id),
        ...withDemoMeta(prev, admin.id, ['remove_broadcast', target.tier, detail]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client.from('broadcasts').delete().eq('id', id);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await appendLiveAdminLog('remove_broadcast', target.tier, detail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const updateUserRole = useCallback(
    (userId: string, role: UserRole) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin' || userId === admin.id) return;
      const target = stateRef.current.profiles.find((p) => p.id === userId);
      if (!target) return;
      const detail = `Changed role for ${target.fullName} to ${role === 'admin' ? 'DO Admin' : 'Student / Faculty'}.`;

      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, role } : p)),
        ...withDemoMeta(prev, admin.id, ['update_user_role', target.email, detail]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client.from('profiles').update({ role }).eq('id', userId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await appendLiveAdminLog('update_user_role', target.email, detail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const toggleUserActive = useCallback(
    (userId: string) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin' || userId === admin.id) return;
      const target = stateRef.current.profiles.find((p) => p.id === userId);
      if (!target) return;
      const nextActive = !target.active;
      const detail = nextActive ? `Reactivated ${target.fullName}.` : `Suspended ${target.fullName}.`;

      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, active: nextActive } : p)),
        ...withDemoMeta(prev, admin.id, ['toggle_user_active', target.email, detail]),
      }));

      if (supabase) {
        const client = supabase;
        runLiveTask(async () => {
          const { error } = await client
            .from('profiles')
            .update({ active: nextActive })
            .eq('id', userId);
          if (error) {
            setSyncError(error.message);
            await hydrateUser(admin.id, true);
            return;
          }
          await appendLiveAdminLog('toggle_user_active', target.email, detail);
        });
      }
    },
    [appendLiveAdminLog, hydrateUser]
  );

  const issueTempPassword = useCallback(
    async (userId: string, options?: { newPassword?: string; requireReset?: boolean }) => {
      const admin = currentUserRef.current;
      if (admin?.role !== 'admin' || userId === admin.id) {
        return { ok: false, error: 'Unauthorized action.' };
      }
      const target = stateRef.current.profiles.find((p) => p.id === userId);
      if (!target) return { ok: false, error: 'Account not found.' };

      const customPassword = options?.newPassword ?? '';
      const requireReset = options?.requireReset ?? true;
      if (customPassword && (customPassword.length < 8 || customPassword.length > 72)) {
        return { ok: false, error: 'New password must be between 8 and 72 characters.' };
      }

      if (supabase) {
        const { data, error } = await supabase.functions.invoke<{
          tempPassword?: string;
          error?: string;
        }>('admin-reset-password', {
          body: {
            targetUserId: userId,
            ...(customPassword ? { newPassword: customPassword } : {}),
            requireReset,
          },
        });
        if (error || !data?.tempPassword) {
          return { ok: false, error: data?.error ?? error?.message ?? 'Could not update password.' };
        }
        await hydrateUser(admin.id, true);
        return { ok: true, tempPassword: data.tempPassword };
      }

      const nextPassword = customPassword || generateTempPassword();
      const detail = customPassword
        ? `Set new password for ${target.fullName}${requireReset ? ' (forced reset on next sign-in)' : ''}.`
        : `Issued temporary password for ${target.fullName}${requireReset ? ' (forced reset on next sign-in)' : ''}.`;

      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === userId ? { ...p, mustChangePassword: requireReset } : p
        ),
        ...withDemoMeta(prev, admin.id, ['issue_temp_password', target.email, detail]),
      }));
      return { ok: true, tempPassword: nextPassword };
    },
    [hydrateUser]
  );

  const isAdmin = currentUser?.role === 'admin';
  const exposedItems = useMemo(
    () =>
      isAdmin
        ? state.items
        : state.items.map((item) =>
            item.hidePhoto && item.images.length > 0 ? { ...item, images: EMPTY_IMAGES } : item
          ),
    [state.items, isAdmin]
  );

  const contextValue = useMemo<LostLinkContextValue>(
    () => ({
      ...state,
      items: exposedItems,
      adminLog: isAdmin ? state.adminLog : EMPTY_STATE.adminLog,
      currentUser,
      authReady,
      isLiveBackend: Boolean(supabase),
      syncError,
      clearSyncError,
      signIn,
      signInDemoRole,
      registerAccount,
      completePasswordReset,
      signOut,
      createItem,
      deleteItem,
      submitClaim,
      submitSighting,
      withdrawClaim,
      markNotificationRead,
      markAllNotificationsRead,
      confirmIntake,
      rejectIntake,
      toggleItemPhotoShield,
      verifyClaim,
      extendCustody,
      markDonationTurnover,
      publishBroadcast,
      removeBroadcast,
      updateUserRole,
      toggleUserActive,
      issueTempPassword,
    }),
    [
      state,
      exposedItems,
      isAdmin,
      currentUser,
      authReady,
      syncError,
      clearSyncError,
      signIn,
      signInDemoRole,
      registerAccount,
      completePasswordReset,
      signOut,
      createItem,
      deleteItem,
      submitClaim,
      submitSighting,
      withdrawClaim,
      markNotificationRead,
      markAllNotificationsRead,
      confirmIntake,
      rejectIntake,
      toggleItemPhotoShield,
      verifyClaim,
      extendCustody,
      markDonationTurnover,
      publishBroadcast,
      removeBroadcast,
      updateUserRole,
      toggleUserActive,
      issueTempPassword,
    ]
  );

  return <LostLinkContext.Provider value={contextValue}>{children}</LostLinkContext.Provider>;
}

export function useLostLink() {
  const ctx = useContext(LostLinkContext);
  if (!ctx) throw new Error('useLostLink must be used inside LostLinkProvider');
  return ctx;
}
