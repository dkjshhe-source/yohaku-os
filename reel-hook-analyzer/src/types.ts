/** Nullable numeric insight: null = not entered, 0 = explicitly zero */
export type NullableNumber = number | null;

export interface RetentionPoint {
  id: string;
  /** seconds from start */
  timeSec: number;
  /** 0–100 viewer percentage */
  percent: number;
}

export interface ReelInsights {
  views: NullableNumber;
  reach: NullableNumber;
  avgWatchSec: NullableNumber;
  skipRate: NullableNumber;
  likes: NullableNumber;
  comments: NullableNumber;
  saves: NullableNumber;
  shares: NullableNumber;
  profileVisits: NullableNumber;
  follows: NullableNumber;
}

export interface ReelPost {
  id: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  title: string;
  postedAt: string;
  durationSec: number | null;
  hookText: string;
  script: string;
  cta: string;
  theme: string;
  format: string;
  memo: string;
  insights: ReelInsights;
  retention: RetentionPoint[];
}

export interface AppData {
  version: 1;
  posts: ReelPost[];
}

export type View =
  | { name: 'list' }
  | { name: 'form'; postId?: string }
  | { name: 'detail'; postId: string; tab?: DetailTab }
  | { name: 'compare' }
  | { name: 'data' };

export type DetailTab =
  | 'overview'
  | 'insights'
  | 'retention'
  | 'hook'
  | 'analysis';

export const emptyInsights = (): ReelInsights => ({
  views: null,
  reach: null,
  avgWatchSec: null,
  skipRate: null,
  likes: null,
  comments: null,
  saves: null,
  shares: null,
  profileVisits: null,
  follows: null,
});

export function createEmptyPost(): Omit<ReelPost, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    url: '',
    title: '',
    postedAt: '',
    durationSec: null,
    hookText: '',
    script: '',
    cta: '',
    theme: '',
    format: '',
    memo: '',
    insights: emptyInsights(),
    retention: [],
  };
}
