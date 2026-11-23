import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountType,
  AdminLogEntry,
  Broadcast,
  BroadcastTier,
  Claim,
  ClaimStatus,
  CollegeCode,
  Item,
  ItemStatus,
  ItemType,
  Notification,
  Profile,
  UserRole,
} from '../types';

export const ITEM_PHOTOS_BUCKET = 'item-photos';

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  account_type: AccountType;
  active: boolean;
  college: CollegeCode;
  program: string;
  student_id: string | null;
  year_level: string | null;
  must_change_password: boolean;
}

export interface ItemRow {
  id: string;
  reference_code: string;
  type: ItemType;
  status: ItemStatus;
  name: string;
  category: string;
  location: string;
  event_date: string;
  description: string;
  images: string[] | null;
  hide_photo: boolean;
  custody_note: string;
  reject_reason: string | null;
  custody_extended_until: string | null;
  donation_turnover: boolean;
  reporter_id: string;
  created_at: string;
}

export interface ClaimRow {
  id: string;
  item_id: string;
  claimant_id: string;
  proof_description: string;
  denial_reason: string | null;
  status: ClaimStatus;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface BroadcastRow {
  id: string;
  tier: BroadcastTier;
  message: string;
  active: boolean;
  created_at: string;
}

export interface AdminLogRow {
  id: string;
  admin_id: string;
  action: string;
  target_label: string;
  detail: string;
  created_at: string;
}

export const mapProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  fullName: r.full_name,
  email: r.email,
  role: r.role,
  accountType: r.account_type,
  active: r.active,
  college: r.college,
  program: r.program,
  studentId: r.student_id,
  yearLevel: r.year_level,
  mustChangePassword: r.must_change_password,
});

export const mapItem = (r: ItemRow): Item => ({
  id: r.id,
  referenceCode: r.reference_code,
  type: r.type,
  status: r.status,
  name: r.name,
  category: r.category,
  location: r.location,
  eventDate: r.event_date,
  description: r.description,
  images: r.images ?? [],
  hidePhoto: r.hide_photo,
  custodyNote: r.custody_note,
  rejectReason: r.reject_reason,
  custodyExtendedUntil: r.custody_extended_until,
  donationTurnover: r.donation_turnover,
  reporterId: r.reporter_id,
  createdAt: r.created_at,
});

export const mapClaim = (r: ClaimRow): Claim => ({
  id: r.id,
  itemId: r.item_id,
  claimantId: r.claimant_id,
  proofDescription: r.proof_description,
  denialReason: r.denial_reason,
  status: r.status,
  createdAt: r.created_at,
});

export const mapNotification = (r: NotificationRow): Notification => ({
  id: r.id,
  userId: r.user_id,
  message: r.message,
  read: r.read,
  createdAt: r.created_at,
});

export const mapBroadcast = (r: BroadcastRow): Broadcast => ({
  id: r.id,
  tier: r.tier,
  message: r.message,
  active: r.active,
  createdAt: r.created_at,
});

export const mapAdminLog = (r: AdminLogRow): AdminLogEntry => ({
  id: r.id,
  adminId: r.admin_id,
  action: r.action,
  targetLabel: r.target_label,
  detail: r.detail,
  createdAt: r.created_at,
});

function isStoragePath(src: string): boolean {
  return Boolean(src) && !src.startsWith('/') && !src.startsWith('http') && !src.startsWith('data:');
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string; mime: string } {
  const match = /^data:(image\/(?:webp|jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Unsupported image payload.');
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
  return { blob: new Blob([bytes], { type: mime }), ext, mime };
}

export async function uploadItemPhotos(
  client: SupabaseClient,
  userId: string,
  images: string[]
): Promise<string[]> {
  const uploaded: string[] = [];
  for (const src of images.slice(0, 3)) {
    if (!src.startsWith('data:')) {
      uploaded.push(src);
      continue;
    }
    const { blob, ext, mime } = dataUrlToBlob(src);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await client.storage
      .from(ITEM_PHOTOS_BUCKET)
      .upload(path, blob, { contentType: mime, upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    uploaded.push(path);
  }
  return uploaded;
}

/** Batch-sign private storage paths in a single request; never sign shielded photos for non-admins. */
export async function signItemImages(
  client: SupabaseClient,
  items: Item[],
  isAdmin: boolean
): Promise<Item[]> {
  const paths = new Set<string>();
  for (const item of items) {
    if (item.hidePhoto && !isAdmin) continue;
    for (const src of item.images) {
      if (isStoragePath(src)) paths.add(src);
    }
  }

  const urlMap = new Map<string, string>();
  if (paths.size > 0) {
    const pathList = Array.from(paths);
    const { data } = await client.storage
      .from(ITEM_PHOTOS_BUCKET)
      .createSignedUrls(pathList, 3600);
    if (data) {
      for (const entry of data) {
        if (entry.path && entry.signedUrl) urlMap.set(entry.path, entry.signedUrl);
      }
    }
  }

  return items.map((item) => {
    if (item.hidePhoto && !isAdmin) return { ...item, images: [] };
    return {
      ...item,
      images: item.images.map((src) => urlMap.get(src) ?? src).filter((src) => !isStoragePath(src)),
    };
  });
}

export async function fetchPortalSnapshot(client: SupabaseClient, user: Profile) {
  const isAdmin = user.role === 'admin';
  const [itemsRes, claimsRes, notifsRes, bcRes, profilesRes, logRes] = await Promise.all([
    client.from('items').select('*').order('created_at', { ascending: false }).limit(200),
    client.from('claims').select('*').order('created_at', { ascending: false }).limit(200),
    client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    client.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(50),
    isAdmin
      ? client.from('profiles').select('*').order('created_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: null }),
    isAdmin
      ? client.from('admin_log').select('*').order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: null }),
  ]);

  const rawItems = ((itemsRes.data ?? []) as ItemRow[]).map(mapItem);
  const items = await signItemImages(client, rawItems, isAdmin);

  return {
    profiles: isAdmin ? ((profilesRes.data ?? []) as ProfileRow[]).map(mapProfile) : [user],
    items,
    claims: ((claimsRes.data ?? []) as ClaimRow[]).map(mapClaim),
    notifications: ((notifsRes.data ?? []) as NotificationRow[]).map(mapNotification),
    broadcasts: ((bcRes.data ?? []) as BroadcastRow[]).map(mapBroadcast),
    adminLog: isAdmin ? ((logRes.data ?? []) as AdminLogRow[]).map(mapAdminLog) : [],
  };
}
