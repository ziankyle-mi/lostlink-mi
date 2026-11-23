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
  fetchPortalSnapshot,
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
  INITIAL_DEMO_STATE,
  ITEM_CATEGORIES,
  PROGRAMS_BY_COLLEGE,
  type PersistedState,
} from './seedData';
import { isDlsauEmail, isStudentId } from './validation';

export { CAMPUS_BUILDINGS, ITEM_CATEGORIES, PROGRAMS_BY_COLLEGE };

const STORAGE_KEY = 'lostlink_dlsau_v1';

function inferCollege(program: string): CollegeCode {
  for (const [college, list] of Object.entries(PROGRAMS_BY_COLLEGE)) {
    if (list.includes(program)) return college as CollegeCode;
  }
  return 'CAST';
}

function makeLogEntry(
  adminId: string,
  action: string,
  targetLabel: string,
  detail: string
): AdminLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    adminId,
    action,
    targetLabel,
    detail,
    createdAt: new Date().toISOString(),
  };
}

function loadInitial(): PersistedState {
  if (supabase) return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_DEMO_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...INITIAL_DEMO_STATE,
      ...parsed,
      adminLog: Array.isArray(parsed.adminLog) ? parsed.adminLog : INITIAL_DEMO_STATE.adminLog,
    };
  } catch {
    return INITIAL_DEMO_STATE;
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
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: Profile }>;
  signInDemoRole: (role: 'student' | 'admin') => Profile;
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
    userId: string
  ) => Promise<{ ok: boolean; tempPassword?: string; error?: string }>;
}

const LostLinkContext = createContext<LostLinkContextValue | null>(null);

export function LostLinkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadInitial);
  const [authReady, setAuthReady] = useState<boolean>(() => !supabase);
  const hydratedUserRef = useRef<string | null>(null);

  const hydrateUser = useCallback(async (userId: string, force = false): Promise<Profile | null> => {
    if (!supabase) return null;
    if (!force && hydratedUserRef.current === userId) return null;
    hydratedUserRef.current = userId;
    const { data: profileRow, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
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
    setState({ currentUserId: profile.id, ...snapshot });
    return profile;
  }, []);

  // Live Supabase auth session bootstrap + listener
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        await hydrateUser(session.user.id);
      } else {
        hydratedUserRef.current = null;
        setState(EMPTY_STATE);
      }
      if (active) setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        hydratedUserRef.current = null;
        setState(EMPTY_STATE);
        setAuthReady(true);
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
  }, [hydrateUser]);

  // Persist demo state to localStorage ONLY when offline (never write live DB data locally)
  useEffect(() => {
    if (supabase) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota warnings in demo mode
    }
  }, [state]);

  const currentUser = state.profiles.find((p) => p.id === state.currentUserId) ?? null;

  // Live Realtime notifications & broadcasts subscription
  useEffect(() => {
    if (!supabase || !currentUser?.id) return;
    const client = supabase;
    const uid = currentUser.id;
    const channel = client
      .channel(`portal-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
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
          .order('created_at', { ascending: false });
        if (data) {
          setState((prev) => ({
            ...prev,
            broadcasts: (data as BroadcastRow[]).map(mapBroadcast),
          }));
        }
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const appendLiveAdminLog = useCallback(
    async (action: string, targetLabel: string, detail: string) => {
      if (!supabase || !currentUser || currentUser.role !== 'admin') return;
      const { data } = await supabase
        .from('admin_log')
        .insert({
          admin_id: currentUser.id,
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
    [currentUser]
  );

  const signIn = async (email: string, password: string) => {
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
      const profile = await hydrateUser(data.user.id, true);
      if (!profile) {
        return { ok: false, error: 'Account is suspended or missing a campus profile. Contact LSB Room 102.' };
      }
      return { ok: true, user: profile };
    }

    const existing = state.profiles.find((p) => p.email.toLowerCase() === clean);
    if (existing && !existing.active) {
      return { ok: false, error: 'This DLSAU account is suspended. Contact LSB Room 102.' };
    }

    const user: Profile = existing ?? {
      id: `user-${Date.now()}`,
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
  };

  const signInDemoRole = (role: 'student' | 'admin') => {
    const targetId = role === 'admin' ? 'user-admin' : 'user-renee';
    const user = state.profiles.find((p) => p.id === targetId) ?? state.profiles[0];
    setState((prev) => ({ ...prev, currentUserId: user.id }));
    return user;
  };

  const registerAccount = async (input: RegisterInput) => {
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

    if (state.profiles.some((p) => p.email.toLowerCase() === email)) {
      return { ok: false, error: 'An account with this @dlsau.edu.ph email already exists.' };
    }

    const user: Profile = {
      id: `user-${Date.now()}`,
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
  };

  const signOut = async () => {
    if (supabase) {
      hydratedUserRef.current = null;
      setState(EMPTY_STATE);
      try {
        await supabase.auth.signOut();
      } catch {
        // Local session state is already cleared
      }
      return;
    }
    setState((prev) => ({ ...prev, currentUserId: null }));
  };

  const completePasswordReset = async (newPassword: string) => {
    if (!currentUser) return { ok: false, error: 'Please sign in first.' };
    if (newPassword.length < 8) {
      return { ok: false, error: 'New password must be at least 8 characters.' };
    }
    if (supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', currentUser.id);
      if (profErr) return { ok: false, error: profErr.message };
      await supabase.from('notifications').insert({
        user_id: currentUser.id,
        message: 'Your DLSAU campus portal password has been updated.',
      });
    }
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === currentUser.id ? { ...p, mustChangePassword: false } : p
      ),
      notifications: supabase
        ? prev.notifications
        : [
            {
              id: `notif-${Date.now()}`,
              userId: currentUser.id,
              message: 'Your DLSAU campus portal password has been updated.',
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...prev.notifications,
          ],
    }));
    return { ok: true };
  };

  const createItem = async (input: CreateItemInput) => {
    if (!currentUser) return { ok: false, error: 'Please sign in first.' };
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
        const uploadedPaths = await uploadItemPhotos(supabase, currentUser.id, input.images);
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
            reporter_id: currentUser.id,
          })
          .select()
          .single();
        if (error || !itemRow) {
          return { ok: false, error: error?.message ?? 'Could not save report.' };
        }
        await supabase.from('notifications').insert({
          user_id: currentUser.id,
          message: notifMsg,
        });
        const [signedItem] = await signItemImages(
          supabase,
          [mapItem(itemRow as ItemRow)],
          currentUser.role === 'admin'
        );
        setState((prev) => ({ ...prev, items: [signedItem, ...prev.items] }));
        return { ok: true, item: signedItem };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Upload failed.' };
      }
    }

    const item: Item = {
      id: `item-${Date.now()}`,
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
      reporterId: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    const notif: Notification = {
      id: `notif-${Date.now()}`,
      userId: currentUser.id,
      message: notifMsg,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      items: [item, ...prev.items],
      notifications: [notif, ...prev.notifications],
    }));
    return { ok: true, item };
  };

  const deleteItem = async (itemId: string) => {
    if (!currentUser) return { ok: false, error: 'Please sign in first.' };
    const target = state.items.find((i) => i.id === itemId);
    if (!target) return { ok: false, error: 'Item not found.' };
    const isAdminUser = currentUser.role === 'admin';
    const isOwnerPending = target.reporterId === currentUser.id && target.status === 'pending';
    if (!isAdminUser && !isOwnerPending) {
      return { ok: false, error: 'You can only delete your own pending reports.' };
    }

    if (supabase) {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) return { ok: false, error: error.message };
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== itemId),
        claims: prev.claims.filter((c) => c.itemId !== itemId),
      }));
      if (isAdminUser) {
        await appendLiveAdminLog('delete_item', target.referenceCode, `Deleted ${target.name}`);
      }
      return { ok: true };
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
      claims: prev.claims.filter((c) => c.itemId !== itemId),
      adminLog: isAdminUser
        ? [
            makeLogEntry(currentUser.id, 'delete_item', target.referenceCode, `Deleted ${target.name}`),
            ...prev.adminLog,
          ]
        : prev.adminLog,
    }));
    return { ok: true };
  };

  const submitClaim = async (itemId: string, proof: string) => {
    if (!currentUser) return { ok: false, error: 'Please sign in first.' };
    const cleanProof = proof.trim();
    if (cleanProof.length < 20) {
      return { ok: false, error: 'Write at least 20 characters of physical proof.' };
    }
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: 'Item not found.' };
    if (item.type !== 'found' || item.status !== 'approved') {
      return { ok: false, error: 'Only approved found items can be claimed.' };
    }
    if (item.reporterId === currentUser.id) {
      return { ok: false, error: 'You cannot submit a claim on an item you reported.' };
    }
    const duplicate = state.claims.some(
      (c) => c.itemId === itemId && c.claimantId === currentUser.id && c.status === 'pending'
    );
    if (duplicate) {
      return { ok: false, error: 'You already have a pending claim on this item.' };
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('claims')
        .insert({
          item_id: itemId,
          claimant_id: currentUser.id,
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
      id: `claim-${Date.now()}`,
      itemId,
      claimantId: currentUser.id,
      proofDescription: cleanProof,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, claims: [claim, ...prev.claims] }));
    return { ok: true };
  };

  const submitSighting = async (itemId: string, note: string) => {
    if (!currentUser) return { ok: false, error: 'Please sign in first.' };
    const cleanNote = note.trim();
    if (cleanNote.length < 20) {
      return { ok: false, error: 'Write at least 20 characters describing the sighting.' };
    }
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.type !== 'lost' || item.status !== 'approved') {
      return { ok: false, error: 'Sightings can only be sent on active lost-item alerts.' };
    }
    if (item.reporterId === currentUser.id) {
      return { ok: false, error: 'You cannot send a sighting on your own lost report.' };
    }

    if (supabase) {
      const { error } = await supabase.from('sightings').insert({
        item_id: itemId,
        sender_id: currentUser.id,
        note: cleanNote,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    const now = new Date().toISOString();
    const ts = Date.now();
    const ownerNotif: Notification = {
      id: `notif-${ts}-r`,
      userId: item.reporterId,
      message: `Sighting on ${item.referenceCode} (${item.name}) from ${currentUser.fullName}: "${cleanNote}"`,
      read: false,
      createdAt: now,
    };
    const senderNotif: Notification = {
      id: `notif-${ts}-s`,
      userId: currentUser.id,
      message: `Your sighting for ${item.referenceCode} (${item.name}) was sent to the owner.`,
      read: false,
      createdAt: now,
    };
    setState((prev) => ({
      ...prev,
      notifications: [ownerNotif, senderNotif, ...prev.notifications],
    }));
    return { ok: true };
  };

  const withdrawClaim = (claimId: string) => {
    setState((prev) => ({
      ...prev,
      claims: prev.claims.map((c) =>
        c.id === claimId && c.claimantId === prev.currentUserId && c.status === 'pending'
          ? { ...c, status: 'withdrawn' }
          : c
      ),
    }));
    if (supabase && currentUser) {
      void supabase
        .from('claims')
        .update({ status: 'withdrawn' })
        .eq('id', claimId)
        .eq('claimant_id', currentUser.id)
        .eq('status', 'pending');
    }
  };

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    if (supabase && currentUser) {
      void supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', currentUser.id);
    }
  };

  const markAllNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.userId === prev.currentUserId ? { ...n, read: true } : n
      ),
    }));
    if (supabase && currentUser) {
      void supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', currentUser.id)
        .eq('read', false);
    }
  };

  const confirmIntake = (itemId: string) => {
    if (currentUser?.role !== 'admin') return;
    const target = state.items.find((i) => i.id === itemId);
    if (!target) return;

    const note = 'LSB Room 102 · Vault Custody';
    const notifMsg = `Security confirmed physical custody for ${target.referenceCode} at LSB Room 102.`;
    const detail = `Confirmed physical custody for ${target.name} at LSB Room 102.`;

    if (supabase) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, status: 'approved', custodyNote: note } : i
        ),
      }));
      void (async () => {
        await supabase.from('items').update({ status: 'approved', custody_note: note }).eq('id', itemId);
        await supabase.from('notifications').insert({ user_id: target.reporterId, message: notifMsg });
        await appendLiveAdminLog('confirm_intake', target.referenceCode, detail);
      })();
      return;
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.id === itemId ? { ...i, status: 'approved', custodyNote: note } : i
      ),
      notifications: [
        {
          id: `notif-${Date.now()}`,
          userId: target.reporterId,
          message: notifMsg,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev.notifications,
      ],
      adminLog: [
        makeLogEntry(currentUser.id, 'confirm_intake', target.referenceCode, detail),
        ...prev.adminLog,
      ],
    }));
  };

  const rejectIntake = (itemId: string, reason: string) => {
    if (currentUser?.role !== 'admin') return;
    const cleanReason = reason.trim();
    if (!cleanReason) return;
    const target = state.items.find((i) => i.id === itemId);
    if (!target) return;

    const custodyNote = `Rejected: ${cleanReason}`;
    const notifMsg = `Report ${target.referenceCode} was rejected by Security Office: ${cleanReason}`;

    if (supabase) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? { ...i, status: 'rejected', rejectReason: cleanReason, custodyNote }
            : i
        ),
      }));
      void (async () => {
        await supabase
          .from('items')
          .update({ status: 'rejected', reject_reason: cleanReason, custody_note: custodyNote })
          .eq('id', itemId);
        await supabase.from('notifications').insert({ user_id: target.reporterId, message: notifMsg });
        await appendLiveAdminLog('reject_intake', target.referenceCode, cleanReason);
      })();
      return;
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.id === itemId
          ? { ...i, status: 'rejected', rejectReason: cleanReason, custodyNote }
          : i
      ),
      notifications: [
        {
          id: `notif-${Date.now()}`,
          userId: target.reporterId,
          message: notifMsg,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev.notifications,
      ],
      adminLog: [
        makeLogEntry(currentUser.id, 'reject_intake', target.referenceCode, cleanReason),
        ...prev.adminLog,
      ],
    }));
  };

  const toggleItemPhotoShield = (itemId: string) => {
    if (currentUser?.role !== 'admin') return;
    const target = state.items.find((i) => i.id === itemId);
    if (!target) return;
    const nextShield = !target.hidePhoto;
    const detail = nextShield
      ? 'Enabled ID Photo Shield (DO Admin only).'
      : 'Disabled ID Photo Shield.';

    if (supabase) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === itemId ? { ...i, hidePhoto: nextShield } : i)),
      }));
      void (async () => {
        await supabase.from('items').update({ hide_photo: nextShield }).eq('id', itemId);
        await appendLiveAdminLog('toggle_photo_shield', target.referenceCode, detail);
      })();
      return;
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, hidePhoto: nextShield } : i)),
      adminLog: [
        makeLogEntry(currentUser.id, 'toggle_photo_shield', target.referenceCode, detail),
        ...prev.adminLog,
      ],
    }));
  };

  const verifyClaim = (claimId: string, decision: 'verified' | 'denied', reason?: string) => {
    if (currentUser?.role !== 'admin') return;
    const cleanReason = reason?.trim() || null;
    const claim = state.claims.find((c) => c.id === claimId);
    if (!claim) return;
    const item = state.items.find((i) => i.id === claim.itemId);
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

    if (supabase) {
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
      }));
      void (async () => {
        await supabase
          .from('claims')
          .update({ status: decision, denial_reason: decision === 'denied' ? cleanReason : null })
          .eq('id', claimId);
        if (decision === 'verified') {
          await supabase
            .from('claims')
            .update({
              status: 'denied',
              denial_reason: 'Item verified and released to another claimant.',
            })
            .eq('item_id', claim.itemId)
            .eq('status', 'pending')
            .neq('id', claimId);
          await supabase
            .from('items')
            .update({ status: 'resolved', custody_note: 'Released to owner' })
            .eq('id', claim.itemId);
        }
        await supabase.from('notifications').insert({ user_id: claim.claimantId, message: notifMsg });
        await appendLiveAdminLog(logAction, refCode, logDetail);
      })();
      return;
    }

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
      notifications: [
        {
          id: `notif-${Date.now()}`,
          userId: claim.claimantId,
          message: notifMsg,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev.notifications,
      ],
      adminLog: [
        makeLogEntry(currentUser.id, logAction, refCode, logDetail),
        ...prev.adminLog,
      ],
    }));
  };

  const extendCustody = (itemId: string) => {
    if (currentUser?.role !== 'admin') return;
    const target = state.items.find((i) => i.id === itemId);
    if (!target || target.type !== 'found' || target.status !== 'approved') return;

    const baseMs = Math.max(
      Date.now(),
      target.custodyExtendedUntil ? Date.parse(target.custodyExtendedUntil) || 0 : 0
    );
    const nextUntil = new Date(baseMs + 14 * 86_400_000).toISOString();
    const untilDate = nextUntil.slice(0, 10);
    const custodyNote = `LSB Room 102 · Hold extended until ${untilDate}`;
    const detail = `Extended hold +14 days (until ${untilDate}).`;

    if (supabase) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, custodyExtendedUntil: nextUntil, custodyNote } : i
        ),
      }));
      void (async () => {
        await supabase
          .from('items')
          .update({ custody_extended_until: nextUntil, custody_note: custodyNote })
          .eq('id', itemId);
        await appendLiveAdminLog('extend_custody', target.referenceCode, detail);
      })();
      return;
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.id === itemId ? { ...i, custodyExtendedUntil: nextUntil, custodyNote } : i
      ),
      adminLog: [
        makeLogEntry(currentUser.id, 'extend_custody', target.referenceCode, detail),
        ...prev.adminLog,
      ],
    }));
  };

  const markDonationTurnover = (itemId: string) => {
    if (currentUser?.role !== 'admin') return;
    const target = state.items.find((i) => i.id === itemId);
    if (!target || target.type !== 'found' || target.status !== 'approved') return;
    const detail = `Closed ${target.name} as campus donation turnover.`;

    if (supabase) {
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
      }));
      void (async () => {
        await supabase
          .from('items')
          .update({
            status: 'resolved',
            donation_turnover: true,
            custody_note: 'Turned over for campus donation',
          })
          .eq('id', itemId);
        await supabase
          .from('claims')
          .update({ status: 'denied', denial_reason: 'Item turned over for campus donation.' })
          .eq('item_id', itemId)
          .eq('status', 'pending');
        await appendLiveAdminLog('donation_turnover', target.referenceCode, detail);
      })();
      return;
    }

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
      adminLog: [
        makeLogEntry(currentUser.id, 'donation_turnover', target.referenceCode, detail),
        ...prev.adminLog,
      ],
    }));
  };

  const publishBroadcast = (tier: BroadcastTier, message: string) => {
    if (currentUser?.role !== 'admin' || !message.trim()) return;
    const clean = message.trim();

    if (supabase) {
      void (async () => {
        const { data } = await supabase
          .from('broadcasts')
          .insert({ tier, message: clean, active: true, created_by: currentUser.id })
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
      })();
      return;
    }

    const next: Broadcast = {
      id: `bc-${Date.now()}`,
      tier,
      message: clean,
      active: true,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      broadcasts: [next, ...prev.broadcasts],
      adminLog: [
        makeLogEntry(currentUser.id, 'publish_broadcast', tier, clean),
        ...prev.adminLog,
      ],
    }));
  };

  const removeBroadcast = (id: string) => {
    if (currentUser?.role !== 'admin') return;
    const target = state.broadcasts.find((b) => b.id === id);
    if (!target) return;

    if (supabase) {
      setState((prev) => ({ ...prev, broadcasts: prev.broadcasts.filter((b) => b.id !== id) }));
      void (async () => {
        await supabase.from('broadcasts').delete().eq('id', id);
        await appendLiveAdminLog('remove_broadcast', target.tier, `Removed: ${target.message}`);
      })();
      return;
    }

    setState((prev) => ({
      ...prev,
      broadcasts: prev.broadcasts.filter((b) => b.id !== id),
      adminLog: [
        makeLogEntry(currentUser.id, 'remove_broadcast', target.tier, `Removed: ${target.message}`),
        ...prev.adminLog,
      ],
    }));
  };

  const updateUserRole = (userId: string, role: UserRole) => {
    if (currentUser?.role !== 'admin' || userId === currentUser.id) return;
    const target = state.profiles.find((p) => p.id === userId);
    if (!target) return;
    const detail = `Changed role for ${target.fullName} to ${role === 'admin' ? 'DO Admin' : 'Student / Faculty'}.`;

    if (supabase) {
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, role } : p)),
      }));
      void (async () => {
        await supabase.from('profiles').update({ role }).eq('id', userId);
        await appendLiveAdminLog('update_user_role', target.email, detail);
      })();
      return;
    }

    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, role } : p)),
      adminLog: [
        makeLogEntry(currentUser.id, 'update_user_role', target.email, detail),
        ...prev.adminLog,
      ],
    }));
  };

  const toggleUserActive = (userId: string) => {
    if (currentUser?.role !== 'admin' || userId === currentUser.id) return;
    const target = state.profiles.find((p) => p.id === userId);
    if (!target) return;
    const nextActive = !target.active;
    const detail = nextActive ? `Reactivated ${target.fullName}.` : `Suspended ${target.fullName}.`;

    if (supabase) {
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, active: nextActive } : p)),
      }));
      void (async () => {
        await supabase.from('profiles').update({ active: nextActive }).eq('id', userId);
        await appendLiveAdminLog('toggle_user_active', target.email, detail);
      })();
      return;
    }

    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, active: nextActive } : p)),
      adminLog: [
        makeLogEntry(currentUser.id, 'toggle_user_active', target.email, detail),
        ...prev.adminLog,
      ],
    }));
  };

  const issueTempPassword = async (userId: string) => {
    if (currentUser?.role !== 'admin' || userId === currentUser.id) {
      return { ok: false, error: 'Unauthorized action.' };
    }
    const target = state.profiles.find((p) => p.id === userId);
    if (!target) return { ok: false, error: 'Account not found.' };

    if (supabase) {
      const { data, error } = await supabase.functions.invoke<{
        tempPassword?: string;
        error?: string;
      }>('admin-reset-password', { body: { targetUserId: userId } });
      if (error || !data?.tempPassword) {
        return { ok: false, error: data?.error ?? error?.message ?? 'Could not issue temporary password.' };
      }
      await hydrateUser(currentUser.id, true);
      return { ok: true, tempPassword: data.tempPassword };
    }

    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === userId ? { ...p, mustChangePassword: true } : p
      ),
      adminLog: [
        makeLogEntry(
          currentUser.id,
          'issue_temp_password',
          target.email,
          `Flagged ${target.fullName} for forced password reset.`
        ),
        ...prev.adminLog,
      ],
    }));
    return { ok: true };
  };

  const isAdmin = currentUser?.role === 'admin';
  const exposedItems = useMemo(
    () =>
      isAdmin
        ? state.items
        : state.items.map((item) => (item.hidePhoto ? { ...item, images: [] } : item)),
    [state.items, isAdmin]
  );

  return (
    <LostLinkContext.Provider
      value={{
        ...state,
        items: exposedItems,
        adminLog: isAdmin ? state.adminLog : [],
        currentUser,
        authReady,
        isLiveBackend: Boolean(supabase),
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
      }}
    >
      {children}
    </LostLinkContext.Provider>
  );
}

export function useLostLink() {
  const ctx = useContext(LostLinkContext);
  if (!ctx) throw new Error('useLostLink must be used inside LostLinkProvider');
  return ctx;
}
