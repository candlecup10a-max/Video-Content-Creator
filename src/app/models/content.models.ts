export interface VideoOutlineSection {
  timing: string;
  title: string;
  script: string;
  visual: string;
}

export interface VideoIdea {
  id: string;
  title: string;
  hook: string;
  conceptSummary: string;
  whyItWorks: string;
  format: string;
  estimatedDuration: string;
  outline: VideoOutlineSection[];
  callToAction: string;
  keyTakeaways: string[];
  createdAt?: number;
  keywords?: string;
}

export interface TitleOption {
  style: string;
  title: string;
}

export interface LinkedInPost {
  hook: string;
  fullPost: string;
  characterCount: number;
  bestPracticeTip: string;
}

export interface FacebookPost {
  fullPost: string;
  characterCount: number;
  bestPracticeTip: string;
}

export interface TikTokPost {
  caption: string;
  onScreenHook: string;
  suggestedAudio: string;
  hashtags: string[];
}

export interface TwitterPost {
  mainTweet: string;
  characterCount: number;
  threadSuggestion?: string[];
}

export interface PlatformPosts {
  linkedin: LinkedInPost;
  facebook: FacebookPost;
  tiktok: TikTokPost;
  twitter: TwitterPost;
}

export interface SocialPackage {
  id: string;
  sourceIdeaId?: string;
  videoTitle: string;
  videoDescription: string;
  titles: TitleOption[];
  captions: {
    short: string;
    long: string;
  };
  hashtags: {
    broad: string[];
    niche: string[];
    trending: string[];
  };
  posts: PlatformPosts;
  pinnedComment: string;
  thumbnailHookText: string;
  createdAt: number;
}

export type ActivePlatformTab = 'tiktok' | 'linkedin' | 'twitter' | 'facebook' | 'captions' | 'hashtags';

export type MainNavTab = 'ideation' | 'schedule' | 'captions' | 'package' | 'saved';

export type ShootStatus = 'planned' | 'filming' | 'recorded' | 'editing' | 'published';

export interface ShootScene {
  id: string;
  title: string;
  description: string;
  durationSec: number;
  visualNotes?: string;
  isCompleted: boolean;
}

export interface ShootEquipmentItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface VideoShootSchedule {
  id: string;
  title: string;
  conceptSummary: string;
  shootDate: string; // YYYY-MM-DD
  shootTime: string; // HH:mm
  location: string;
  format: string; // "9:16 Reel / Short", "16:9 Landscape", "Talking Head", "Tutorial"
  targetDuration: string;
  status: ShootStatus;
  equipmentChecklist: ShootEquipmentItem[];
  scenes: ShootScene[];
  linkedIdeaId?: string;
  notes?: string;
  createdAt: number;
  recordedVideoId?: string;
}

export interface CaptionSegment {
  id: string;
  index: number;
  startTime: string; // e.g. "00:01.200" or "00:00:01"
  startSeconds: number;
  endTime: string; // e.g. "00:04.500" or "00:00:04"
  endSeconds: number;
  text: string;
  speaker?: string;
}

export interface VideoCaptionProject {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  videoUrl?: string;
  durationSeconds: number;
  language: string;
  captions: CaptionSegment[];
  fullTranscript: string;
  status: 'idle' | 'transcribing' | 'ready' | 'error';
  hasSpeech?: boolean;
  transcriptionSource?: 'audio_analysis' | 'manual_script' | 'concept_synthesis';
  analysisNotice?: string;
  linkedScheduleId?: string;
  createdAt: number;
}
