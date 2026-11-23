export type UserRole = 'user' | 'admin';
export type AccountType = 'student' | 'faculty';
export type ItemType = 'found' | 'lost';
export type ItemStatus = 'pending' | 'approved' | 'claimed' | 'resolved' | 'rejected';
export type ClaimStatus = 'pending' | 'verified' | 'denied' | 'withdrawn';
export type BroadcastTier = 'Info' | 'Warning' | 'Alert';
export type CollegeCode = 'CAST' | 'CVMAS' | 'CBMA' | 'COED';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  accountType: AccountType;
  active: boolean;
  college: CollegeCode;
  program: string;
  studentId: string | null;
  yearLevel: string | null;
  mustChangePassword: boolean;
}

export interface Item {
  id: string;
  referenceCode: string;
  type: ItemType;
  status: ItemStatus;
  name: string;
  category: string;
  location: string;
  eventDate: string;
  description: string;
  images: string[];
  hidePhoto: boolean;
  custodyNote: string;
  rejectReason?: string | null;
  custodyExtendedUntil?: string | null;
  donationTurnover?: boolean;
  reporterId: string;
  createdAt: string;
}

export interface Claim {
  id: string;
  itemId: string;
  claimantId: string;
  proofDescription: string;
  denialReason?: string | null;
  status: ClaimStatus;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Broadcast {
  id: string;
  tier: BroadcastTier;
  message: string;
  active: boolean;
  createdAt: string;
}

export interface AdminLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetLabel: string;
  detail: string;
  createdAt: string;
}
