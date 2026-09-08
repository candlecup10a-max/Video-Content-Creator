import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {
  CaptionSegment,
  MainNavTab,
  ShootEquipmentItem,
  ShootScene,
  ShootStatus,
  SocialPackage,
  VideoCaptionProject,
  VideoIdea,
  VideoShootSchedule,
  VisualContentAnalysis,
} from '../models/content.models';
import {extractAudioFromMedia} from '../utils/audio-extractor';
import {extractVideoKeyframes, VideoFrameSample} from '../utils/video-frame-extractor';

const STORAGE_SAVED_IDEAS = 'vcc_saved_ideas_v1';
const STORAGE_SAVED_PACKAGES = 'vcc_saved_packages_v1';
const STORAGE_SCHEDULES = 'vcc_schedules_v1';
const STORAGE_CAPTION_PROJECTS = 'vcc_caption_projects_v1';

function extractApiError(err: unknown, fallbackMessage: string): string {
  if (!err) return fallbackMessage;

  const httpErr = err as {
    error?: { error?: string | { message?: string }; message?: string } | string;
    message?: string;
  };

  let raw = '';
  if (typeof httpErr.error === 'string') {
    raw = httpErr.error;
  } else if (httpErr.error && typeof httpErr.error === 'object') {
    if (typeof httpErr.error.error === 'string') {
      raw = httpErr.error.error;
    } else if (
      httpErr.error.error &&
      typeof httpErr.error.error === 'object' &&
      'message' in httpErr.error.error
    ) {
      raw = String(httpErr.error.error.message || '');
    } else if (typeof httpErr.error.message === 'string') {
      raw = httpErr.error.message;
    }
  }

  if (!raw && err instanceof Error && !err.message.startsWith('Http failure response')) {
    raw = err.message;
  }

  // Iteratively unwrap JSON strings if present
  for (let i = 0; i < 3; i++) {
    if (raw && (raw.startsWith('{') || raw.startsWith('['))) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) {
          raw = parsed.error.message;
        } else if (parsed?.message) {
          raw = parsed.message;
        } else if (parsed?.error && typeof parsed.error === 'string') {
          raw = parsed.error;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  }

  if (
    raw.includes('503') ||
    raw.includes('high demand') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('temporarily')
  ) {
    return 'The AI service is temporarily experiencing high demand. Please click Retry.';
  }

  if (
    raw.includes('quota') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('429') ||
    raw.includes('rate-limit') ||
    raw.includes('rate limit')
  ) {
    return 'The AI service rate limit was reached. Please wait a few moments and click Retry.';
  }

  return raw || fallbackMessage;
}

@Injectable({
  providedIn: 'root',
})
export class ContentCreator {
  private readonly http = inject(HttpClient);

  // Core reactive signals
  readonly activeTab = signal<MainNavTab>('ideation');
  readonly ideas = signal<VideoIdea[]>([]);
  readonly selectedIdea = signal<VideoIdea | null>(null);
  readonly currentPackage = signal<SocialPackage | null>(null);

  // Schedules & Shoot Planning
  readonly schedules = signal<VideoShootSchedule[]>([]);
  readonly selectedSchedule = signal<VideoShootSchedule | null>(null);
  readonly isGeneratingShootPlan = signal<boolean>(false);

  // Video Captions & Project
  readonly captionProjects = signal<VideoCaptionProject[]>([]);
  readonly activeCaptionProject = signal<VideoCaptionProject | null>(null);
  readonly activeVideoFile = signal<File | null>(null);
  readonly captionExtractionProgress = signal<string>('');
  readonly isSeparatingCaptions = signal<boolean>(false);
  readonly videoCurrentTime = signal<number>(0);
  readonly isVideoPlaying = signal<boolean>(false);

  readonly savedIdeas = signal<VideoIdea[]>([]);
  readonly savedPackages = signal<SocialPackage[]>([]);

  readonly isGeneratingIdeas = signal<boolean>(false);
  readonly isGeneratingPackage = signal<boolean>(false);
  readonly isRefining = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.loadFromStorage();
  }

  setTab(tab: MainNavTab): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
  }

  async generateIdeas(params: {
    keywords: string;
    niche?: string;
    tone?: string;
    targetLength?: string;
    targetAudience?: string;
  }): Promise<void> {
    this.isGeneratingIdeas.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<{ideas: VideoIdea[]; error?: string}>('/api/ideas', params)
      );

      if (response?.error) {
        throw new Error(response.error);
      }

      const generated = (response?.ideas || []).map((item, idx) => ({
        ...item,
        id: item.id || `idea-${Date.now()}-${idx}`,
        createdAt: Date.now(),
        keywords: params.keywords,
      }));

      this.ideas.set(generated);
      if (generated.length > 0) {
        this.selectedIdea.set(generated[0]);
      }
    } catch (err: unknown) {
      console.error('Failed to generate ideas:', err);
      const message = extractApiError(
        err,
        'Failed to generate ideas. The AI model was busy or experiencing high demand. Please click Retry.'
      );
      this.errorMessage.set(message);
    } finally {
      this.isGeneratingIdeas.set(false);
    }
  }

  async generateSocialPackage(params: {
    videoTitle: string;
    videoDescription: string;
    keyPoints?: string[];
    keywords?: string;
    tone?: string;
    sourceIdeaId?: string;
  }): Promise<SocialPackage | null> {
    this.isGeneratingPackage.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<SocialPackage & {error?: string}>('/api/social-package', params)
      );

      if (response?.error) {
        throw new Error(response.error);
      }

      const pkg: SocialPackage = {
        id: `pkg-${Date.now()}`,
        sourceIdeaId: params.sourceIdeaId,
        videoTitle: params.videoTitle,
        videoDescription: params.videoDescription,
        titles: response.titles || [],
        captions: response.captions || { short: '', long: '' },
        hashtags: response.hashtags || { broad: [], niche: [], trending: [] },
        posts: response.posts || {
          linkedin: { hook: '', fullPost: '', characterCount: 0, bestPracticeTip: '' },
          facebook: { fullPost: '', characterCount: 0, bestPracticeTip: '' },
          tiktok: { caption: '', onScreenHook: '', suggestedAudio: '', hashtags: [] },
          twitter: { mainTweet: '', characterCount: 0, threadSuggestion: [] },
        },
        pinnedComment: response.pinnedComment || '',
        thumbnailHookText: response.thumbnailHookText || '',
        createdAt: Date.now(),
      };

      this.currentPackage.set(pkg);
      this.activeTab.set('package');
      return pkg;
    } catch (err: unknown) {
      console.error('Failed to generate social package:', err);
      const message = extractApiError(
        err,
        'Failed to generate social media posts. The AI model was busy. Please click Retry.'
      );
      this.errorMessage.set(message);
      return null;
    } finally {
      this.isGeneratingPackage.set(false);
    }
  }

  async refineText(platform: string, currentContent: string, instruction: string): Promise<string> {
    this.isRefining.set(true);
    try {
      const response = await firstValueFrom(
        this.http.post<{refinedContent?: string; error?: string}>('/api/refine', {
          platform,
          currentContent,
          instruction,
        })
      );
      if (response?.error) {
        throw new Error(response.error);
      }
      return response.refinedContent || currentContent;
    } catch (err: unknown) {
      console.error('Refine failed:', err);
      const message = extractApiError(err, 'Could not refine text. Please try again.');
      throw new Error(message);
    } finally {
      this.isRefining.set(false);
    }
  }

  selectIdeaForPackaging(idea: VideoIdea): void {
    this.selectedIdea.set(idea);
    // Switch to packaging and automatically generate or populate
    this.activeTab.set('package');
  }

  // Persistence methods
  toggleSaveIdea(idea: VideoIdea): boolean {
    const list = this.savedIdeas();
    const existingIndex = list.findIndex((i) => i.id === idea.id);

    let updated: VideoIdea[];
    let isSavedNow = false;

    if (existingIndex >= 0) {
      updated = list.filter((i) => i.id !== idea.id);
      isSavedNow = false;
    } else {
      updated = [idea, ...list];
      isSavedNow = true;
    }

    this.savedIdeas.set(updated);
    this.persistToStorage(STORAGE_SAVED_IDEAS, updated);
    return isSavedNow;
  }

  isIdeaSaved(id: string): boolean {
    return this.savedIdeas().some((i) => i.id === id);
  }

  deleteSavedIdea(id: string): void {
    const updated = this.savedIdeas().filter((i) => i.id !== id);
    this.savedIdeas.set(updated);
    this.persistToStorage(STORAGE_SAVED_IDEAS, updated);
  }

  saveCurrentPackage(): void {
    const current = this.currentPackage();
    if (!current) return;

    const list = this.savedPackages();
    const filtered = list.filter((p) => p.id !== current.id);
    const updated = [current, ...filtered];

    this.savedPackages.set(updated);
    this.persistToStorage(STORAGE_SAVED_PACKAGES, updated);
  }

  deleteSavedPackage(id: string): void {
    const updated = this.savedPackages().filter((p) => p.id !== id);
    this.savedPackages.set(updated);
    this.persistToStorage(STORAGE_SAVED_PACKAGES, updated);
  }

  loadSavedPackage(pkg: SocialPackage): void {
    this.currentPackage.set(pkg);
    this.activeTab.set('package');
  }

  updatePostText(platform: 'linkedin' | 'facebook' | 'tiktok' | 'twitter', newText: string): void {
    const pkg = this.currentPackage();
    if (!pkg) return;

    const updated = {...pkg, posts: {...pkg.posts}};
    if (platform === 'linkedin') {
      updated.posts.linkedin = {
        ...updated.posts.linkedin,
        fullPost: newText,
        characterCount: newText.length,
      };
    } else if (platform === 'facebook') {
      updated.posts.facebook = {
        ...updated.posts.facebook,
        fullPost: newText,
        characterCount: newText.length,
      };
    } else if (platform === 'tiktok') {
      updated.posts.tiktok = {
        ...updated.posts.tiktok,
        caption: newText,
      };
    } else if (platform === 'twitter') {
      updated.posts.twitter = {
        ...updated.posts.twitter,
        mainTweet: newText,
        characterCount: newText.length,
      };
    }

    this.currentPackage.set(updated);
  }

  // ==========================================
  // Video Taking Schedule Management
  // ==========================================

  selectSchedule(schedule: VideoShootSchedule | null): void {
    this.selectedSchedule.set(schedule);
  }

  createSchedule(data: {
    title: string;
    conceptSummary: string;
    shootDate: string;
    shootTime?: string;
    location?: string;
    format?: string;
    targetDuration?: string;
    notes?: string;
    linkedIdeaId?: string;
  }): VideoShootSchedule {
    const newSchedule: VideoShootSchedule = {
      id: `sched-${Date.now().toString(36)}`,
      title: data.title.trim() || 'Untitled Video Shoot',
      conceptSummary: data.conceptSummary.trim() || 'New video production',
      shootDate: data.shootDate || new Date().toISOString().split('T')[0],
      shootTime: data.shootTime || '14:00',
      location: data.location || 'Studio Desk Setup',
      format: data.format || '9:16 Reel / Short',
      targetDuration: data.targetDuration || '45-60s',
      status: 'planned',
      equipmentChecklist: [
        { id: `eq-${Date.now()}-1`, name: 'Camera or Smartphone (4K 30/60fps)', checked: false },
        { id: `eq-${Date.now()}-2`, name: 'Wireless clip-on microphone', checked: false },
        { id: `eq-${Date.now()}-3`, name: 'Key lighting (Softbox or Ring light at 45°)', checked: false },
        { id: `eq-${Date.now()}-4`, name: 'Clean desk / background set', checked: false },
        { id: `eq-${Date.now()}-5`, name: 'Script talking points & battery full', checked: false },
      ],
      scenes: [
        {
          id: `sc-${Date.now()}-1`,
          title: 'Scene 1: Hook & Attention Grabber',
          description: 'High energy 3-5 second opening question or contrarian statement.',
          durationSec: 5,
          visualNotes: 'Close-up, fast zoom or cut',
          isCompleted: false,
        },
        {
          id: `sc-${Date.now()}-2`,
          title: 'Scene 2: The Core Problem & Setup',
          description: 'Explain why current habits fail and introduce the insight.',
          durationSec: 15,
          visualNotes: 'Medium shot with hand gestures',
          isCompleted: false,
        },
        {
          id: `sc-${Date.now()}-3`,
          title: 'Scene 3: Main Demonstration / Solution',
          description: 'Show the step-by-step framework or b-roll screen demonstration.',
          durationSec: 25,
          visualNotes: 'Screen recording or over-the-shoulder b-roll',
          isCompleted: false,
        },
        {
          id: `sc-${Date.now()}-4`,
          title: 'Scene 4: Call to Action',
          description: 'Prompt viewers to comment, save, or follow for part 2.',
          durationSec: 10,
          visualNotes: 'Direct eye contact, gesture down to comment field',
          isCompleted: false,
        },
      ],
      notes: data.notes || '',
      linkedIdeaId: data.linkedIdeaId,
      createdAt: Date.now(),
    };

    const updated = [newSchedule, ...this.schedules()];
    this.schedules.set(updated);
    this.selectedSchedule.set(newSchedule);
    this.persistToStorage(STORAGE_SCHEDULES, updated);
    return newSchedule;
  }

  scheduleFromIdea(idea: VideoIdea): void {
    const today = new Date().toISOString().split('T')[0];
    const scenes: ShootScene[] = (idea.outline || []).map((sec, idx) => ({
      id: `sc-${Date.now()}-${idx}`,
      title: sec.title || `Scene ${idx + 1}: ${sec.timing || ''}`,
      description: sec.script || sec.visual || 'Deliver key insight',
      durationSec: 15,
      visualNotes: sec.visual || 'Dynamic medium framing',
      isCompleted: false,
    }));

    if (scenes.length === 0) {
      scenes.push(
        {
          id: `sc-${Date.now()}-1`,
          title: 'Hook',
          description: idea.hook || 'Open with gripping pattern interrupt',
          durationSec: 5,
          visualNotes: 'Tight close-up framing',
          isCompleted: false,
        },
        {
          id: `sc-${Date.now()}-2`,
          title: 'Core Concept',
          description: idea.conceptSummary || 'Explain the premise',
          durationSec: 25,
          visualNotes: 'Medium shot with graphics',
          isCompleted: false,
        },
        {
          id: `sc-${Date.now()}-3`,
          title: 'Call to Action',
          description: idea.callToAction || 'Ask for viewer thoughts',
          durationSec: 10,
          visualNotes: 'Direct eye contact',
          isCompleted: false,
        }
      );
    }

    const newSchedule: VideoShootSchedule = {
      id: `sched-${Date.now().toString(36)}`,
      title: idea.title,
      conceptSummary: idea.conceptSummary,
      shootDate: today,
      shootTime: '14:30',
      location: 'Studio Desk Setup',
      format: idea.format || '9:16 Reel / Short',
      targetDuration: idea.estimatedDuration || '60s',
      status: 'planned',
      equipmentChecklist: [
        { id: `eq-${Date.now()}-1`, name: 'Camera or Smartphone (4K 30/60fps)', checked: true },
        { id: `eq-${Date.now()}-2`, name: 'Wireless clip-on microphone', checked: true },
        { id: `eq-${Date.now()}-3`, name: 'Soft key light set at 5600K 45° angle', checked: false },
        { id: `eq-${Date.now()}-4`, name: 'Clean desk background & prop setup', checked: false },
        { id: `eq-${Date.now()}-5`, name: 'Teleprompter loaded with script', checked: false },
      ],
      scenes,
      linkedIdeaId: idea.id,
      notes: `Key Takeaways:\n${(idea.keyTakeaways || []).map((k) => `• ${k}`).join('\n')}`,
      createdAt: Date.now(),
    };

    const updated = [newSchedule, ...this.schedules()];
    this.schedules.set(updated);
    this.selectedSchedule.set(newSchedule);
    this.persistToStorage(STORAGE_SCHEDULES, updated);
    this.activeTab.set('schedule');
  }

  updateSchedule(id: string, updates: Partial<VideoShootSchedule>): void {
    const list = this.schedules().map((item) => {
      if (item.id === id) {
        return { ...item, ...updates };
      }
      return item;
    });
    this.schedules.set(list);
    if (this.selectedSchedule()?.id === id) {
      this.selectedSchedule.set({ ...this.selectedSchedule()!, ...updates });
    }
    this.persistToStorage(STORAGE_SCHEDULES, list);
  }

  deleteSchedule(id: string): void {
    const updated = this.schedules().filter((s) => s.id !== id);
    this.schedules.set(updated);
    if (this.selectedSchedule()?.id === id) {
      this.selectedSchedule.set(updated.length > 0 ? updated[0] : null);
    }
    this.persistToStorage(STORAGE_SCHEDULES, updated);
  }

  toggleEquipmentCheck(scheduleId: string, equipId: string): void {
    const schedule = this.schedules().find((s) => s.id === scheduleId);
    if (!schedule) return;

    const updatedEquip = schedule.equipmentChecklist.map((item) =>
      item.id === equipId ? { ...item, checked: !item.checked } : item
    );
    this.updateSchedule(scheduleId, { equipmentChecklist: updatedEquip });
  }

  toggleSceneComplete(scheduleId: string, sceneId: string): void {
    const schedule = this.schedules().find((s) => s.id === scheduleId);
    if (!schedule) return;

    const updatedScenes = schedule.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, isCompleted: !scene.isCompleted } : scene
    );
    this.updateSchedule(scheduleId, { scenes: updatedScenes });
  }

  updateShootStatus(scheduleId: string, status: ShootStatus): void {
    this.updateSchedule(scheduleId, { status });
  }

  async generateAiShootPlan(params: {
    title: string;
    conceptSummary?: string;
    format?: string;
    targetDuration?: string;
    location?: string;
  }): Promise<void> {
    this.isGeneratingShootPlan.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<{
          scenes: { title: string; description: string; durationSec: number; visualNotes: string }[];
          equipmentChecklist: string[];
          directorTips?: string[];
          error?: string;
        }>('/api/generate-shoot-plan', params)
      );

      if (response?.error) {
        throw new Error(response.error);
      }

      const scenes: ShootScene[] = (response?.scenes || []).map((s, idx) => ({
        id: `sc-ai-${Date.now()}-${idx}`,
        title: s.title,
        description: s.description,
        durationSec: s.durationSec || 15,
        visualNotes: s.visualNotes || '',
        isCompleted: false,
      }));

      const equipmentChecklist: ShootEquipmentItem[] = (response?.equipmentChecklist || []).map((eq, idx) => ({
        id: `eq-ai-${Date.now()}-${idx}`,
        name: eq,
        checked: false,
      }));

      const current = this.selectedSchedule();
      if (current) {
        let notes = current.notes || '';
        if (response?.directorTips?.length) {
          notes = `${notes}\n\nDirector Tips:\n${response.directorTips.map((t) => `• ${t}`).join('\n')}`.trim();
        }
        this.updateSchedule(current.id, {
          scenes,
          equipmentChecklist,
          notes,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to generate shoot plan:', err);
      const message = extractApiError(err, 'Failed to generate shoot plan. Please try again.');
      this.errorMessage.set(message);
    } finally {
      this.isGeneratingShootPlan.set(false);
    }
  }

  // ==========================================
  // Video Upload & Separated Captions
  // ==========================================

  createNewCaptionProject(): void {
    this.activeCaptionProject.set(null);
    this.videoCurrentTime.set(0);
    this.isVideoPlaying.set(false);
  }

  async relinkVideoFile(file: File): Promise<void> {
    const current = this.activeCaptionProject();
    if (!current) {
      await this.loadVideoFile(file);
      return;
    }

    const duration = await this.extractVideoDuration(file);
    const objectUrl = URL.createObjectURL(file);
    const updated: VideoCaptionProject = {
      ...current,
      fileName: file.name,
      fileSize: file.size,
      videoUrl: objectUrl,
      durationSeconds: duration > 0 ? duration : current.durationSeconds,
    };

    this.activeCaptionProject.set(updated);
    this.updateCaptionProjectInList(updated);
  }

  private async extractVideoDuration(file: File): Promise<number> {
    if (typeof window === 'undefined') return 45;
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const url = URL.createObjectURL(file);
        video.src = url;
        const timer = setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(45);
        }, 3500);

        video.onloadedmetadata = () => {
          clearTimeout(timer);
          const d = video.duration;
          URL.revokeObjectURL(url);
          resolve(!isNaN(d) && d > 0 ? Math.round(d * 10) / 10 : 45);
        };

        video.onerror = () => {
          clearTimeout(timer);
          URL.revokeObjectURL(url);
          resolve(45);
        };
      } catch {
        resolve(45);
      }
    });
  }

  private async fileToBase64(file: File): Promise<string | null> {
    if (file.size > 22 * 1024 * 1024) {
      return null;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(',');
        if (commaIdx !== -1) {
          resolve(result.substring(commaIdx + 1));
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async loadVideoFile(file: File, linkedScheduleId?: string): Promise<VideoCaptionProject> {
    if (!file) {
      throw new Error('No video file provided');
    }

    this.activeVideoFile.set(file);
    const duration = await this.extractVideoDuration(file);
    const objectUrl = URL.createObjectURL(file);
    const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    const project: VideoCaptionProject = {
      id: `proj-${Date.now().toString(36)}`,
      title,
      fileName: file.name,
      fileSize: file.size,
      videoUrl: objectUrl,
      durationSeconds: duration,
      language: 'English',
      captions: [],
      fullTranscript: '',
      status: 'idle',
      linkedScheduleId,
      createdAt: Date.now(),
    };

    this.activeCaptionProject.set(project);
    const updated = [project, ...this.captionProjects().filter((p) => p.id !== project.id)];
    this.captionProjects.set(updated);
    this.persistCaptionProjects(updated);

    // If linked to a schedule, mark that schedule as recorded
    if (linkedScheduleId) {
      this.updateShootStatus(linkedScheduleId, 'recorded');
    }

    return project;
  }

  async separateCaptionsForFile(file?: File): Promise<void> {
    const project = this.activeCaptionProject();
    if (!project) return;

    const targetFile = file || this.activeVideoFile();
    if (!targetFile) {
      // No media file loaded in memory; separate using script or schedule concept
      await this.separateCaptions({
        durationSeconds: project.durationSeconds > 0 ? project.durationSeconds : 45,
      });
      return;
    }

    this.activeVideoFile.set(targetFile);
    this.isSeparatingCaptions.set(true);
    this.errorMessage.set(null);
    this.captionExtractionProgress.set('Inspecting video audio track & extracting scene frames...');

    try {
      // 1. Extract clean audio from video container
      let extracted: { audioBase64?: string; mimeType?: string; duration: number; isSilent?: boolean } | null = null;
      try {
        extracted = await extractAudioFromMedia(targetFile);
      } catch (audioErr) {
        console.warn('Audio extraction warning:', audioErr);
      }

      // 2. Extract visual keyframe samples across video duration
      let videoFrames: VideoFrameSample[] = [];
      try {
        const visualResult = await extractVideoKeyframes(targetFile, {
          maxFrames: 6,
          maxDimension: 480,
          targetDuration: extracted?.duration || project.durationSeconds || 15,
        });
        if (visualResult.frames && visualResult.frames.length > 0) {
          videoFrames = visualResult.frames;
        }
      } catch (vfErr) {
        console.warn('Visual frame extraction notice:', vfErr);
      }

      // 3. Determine if video is without speech / silent:
      const isCompletelySilent = !extracted || extracted.isSilent === true || !extracted.audioBase64;

      if (isCompletelySilent || !extracted) {
        this.captionExtractionProgress.set('Video has no speech track. Analyzing visual scenes with Gemini Vision...');
        await this.analyzeVisualContent({
          videoFrames,
          durationSeconds: extracted?.duration || project.durationSeconds || 15,
        });
        return;
      }

      // Audio track has sound: send audioBase64 AND visual keyframes.
      // If the audio turns out to be music-only or lacks speech, the backend automatically performs visual analysis!
      this.captionExtractionProgress.set('Analyzing speech & syncing subtitle timestamps with Gemini AI...');
      await this.separateCaptions({
        audioBase64: extracted.audioBase64,
        mimeType: extracted.mimeType,
        videoFrames,
        durationSeconds: extracted.duration > 0 ? extracted.duration : project.durationSeconds || 45,
      });
    } catch (err: unknown) {
      console.error('Failed to process video audio for captions:', err);
      const msg = extractApiError(err, 'Failed to extract audio or transcribe video speech.');
      this.errorMessage.set(msg);
      const errorProject: VideoCaptionProject = { ...project, status: 'error' };
      this.activeCaptionProject.set(errorProject);
      this.updateCaptionProjectInList(errorProject);
    } finally {
      this.captionExtractionProgress.set('');
      this.isSeparatingCaptions.set(false);
    }
  }

  setVideoCurrentTime(time: number): void {
    this.videoCurrentTime.set(time);
  }

  setVideoPlaying(playing: boolean): void {
    this.isVideoPlaying.set(playing);
  }

  setProjectVideoDuration(durationSec: number): void {
    const current = this.activeCaptionProject();
    if (!current) return;
    const updated = { ...current, durationSeconds: Math.round(durationSec * 10) / 10 };
    this.activeCaptionProject.set(updated);
    this.updateCaptionProjectInList(updated);
  }

  async separateCaptions(options?: {
    rawText?: string;
    durationSeconds?: number;
    audioBase64?: string;
    mimeType?: string;
    videoFrames?: VideoFrameSample[];
    forceVisualAnalysis?: boolean;
  }): Promise<void> {
    const project = this.activeCaptionProject();
    if (!project) {
      this.errorMessage.set('Please select or upload a video first.');
      return;
    }

    this.isSeparatingCaptions.set(true);
    this.errorMessage.set(null);

    // Update status to transcribing
    const transcribingProject: VideoCaptionProject = { ...project, status: 'transcribing' };
    this.activeCaptionProject.set(transcribingProject);

    try {
      const payload: Record<string, unknown> = {
        videoTitle: project.title,
        durationSeconds: options?.durationSeconds || project.durationSeconds || 45,
      };

      if (options?.audioBase64) {
        payload['audioBase64'] = options.audioBase64;
        payload['mimeType'] = options.mimeType || 'audio/wav';
      }

      if (options?.videoFrames && options.videoFrames.length > 0) {
        payload['videoFrames'] = options.videoFrames;
      }

      if (options?.forceVisualAnalysis) {
        payload['forceVisualAnalysis'] = true;
      }

      if (options?.rawText) {
        payload['rawText'] = options.rawText;
      } else if (!options?.audioBase64 && !options?.forceVisualAnalysis) {
        // Look up linked shoot schedule to pass concept & scene scripts
        const schedule = this.schedules().find((s) => s.id === project.linkedScheduleId);
        if (schedule) {
          const scenesText = schedule.scenes.map((s) => s.description).join(' ');
          payload['rawText'] = `${schedule.conceptSummary}. ${scenesText}`;
        }
      }

      const response = await firstValueFrom(
        this.http.post<{
          language: string;
          hasSpeech?: boolean;
          isVideoSilent?: boolean;
          transcriptionSource?: 'audio_analysis' | 'manual_script' | 'concept_synthesis' | 'speech_fallback' | 'visual_analysis';
          visualAnalysis?: VisualContentAnalysis;
          fullTranscript: string;
          captions: CaptionSegment[];
          message?: string;
          notice?: string;
          isFallback?: boolean;
          error?: string;
        }>('/api/separate-captions', payload)
      );

      if (response?.error) {
        throw new Error(response.error);
      }

      const hasSpeech = response?.hasSpeech !== false && (response?.captions?.length || 0) > 0;
      const isVideoSilent = response?.isVideoSilent === true || (!hasSpeech && Boolean(response?.visualAnalysis));
      const transcriptionSource = response?.transcriptionSource || (
        isVideoSilent
          ? 'visual_analysis'
          : response?.isFallback
          ? 'speech_fallback'
          : options?.audioBase64
          ? 'audio_analysis'
          : options?.rawText
          ? 'manual_script'
          : 'concept_synthesis'
      );

      const analysisNotice =
        response?.notice ||
        response?.message ||
        (!hasSpeech && !isVideoSilent && options?.audioBase64
          ? 'No spoken words detected in this video track. You can type or paste a script to generate timed captions.'
          : undefined);

      const updatedProject: VideoCaptionProject = {
        ...project,
        language: response?.language || 'English',
        fullTranscript: response?.fullTranscript || '',
        captions: response?.captions || [],
        status: 'ready',
        hasSpeech,
        isVideoSilent,
        transcriptionSource,
        visualAnalysis: response?.visualAnalysis,
        analysisNotice,
      };

      this.activeCaptionProject.set(updatedProject);
      this.updateCaptionProjectInList(updatedProject);
    } catch (err: unknown) {
      console.error('Failed to separate captions:', err);
      const message = extractApiError(err, 'Failed to separate captions. Please click Retry.');
      this.errorMessage.set(message);

      // Provide emergency captions so the user is never stranded on an unusable screen
      const existing = project.captions || [];
      const emergencyCaptions =
        existing.length > 0
          ? existing
          : this.createEmergencyCaptionSegments(project.title, project.durationSeconds);

      const fallbackProject: VideoCaptionProject = {
        ...project,
        status: 'ready',
        captions: emergencyCaptions,
        fullTranscript: project.fullTranscript || project.title,
        analysisNotice: `${message} Synchronized starter subtitle segments have been loaded for your video duration so you can edit directly. Click Retry to re-run AI transcription.`,
        transcriptionSource: 'speech_fallback',
      };
      this.activeCaptionProject.set(fallbackProject);
      this.updateCaptionProjectInList(fallbackProject);
    } finally {
      this.isSeparatingCaptions.set(false);
      this.captionExtractionProgress.set('');
    }
  }

  /**
   * Dedicated method for analyzing visual content of silent videos, B-roll, or aesthetic montages.
   */
  async analyzeVisualContent(options?: {
    videoFrames?: VideoFrameSample[];
    durationSeconds?: number;
  }): Promise<void> {
    const project = this.activeCaptionProject();
    if (!project) return;

    this.isSeparatingCaptions.set(true);
    this.errorMessage.set(null);
    this.captionExtractionProgress.set('Analyzing visual scenes, objects & pacing with Gemini Vision...');

    const transcribingProject: VideoCaptionProject = { ...project, status: 'transcribing' };
    this.activeCaptionProject.set(transcribingProject);

    try {
      let frames = options?.videoFrames;
      const targetDuration = options?.durationSeconds || project.durationSeconds || 15;

      if (!frames || frames.length === 0) {
        const file = this.activeVideoFile();
        if (file) {
          const res = await extractVideoKeyframes(file, {
            maxFrames: 6,
            maxDimension: 480,
            targetDuration,
          });
          frames = res.frames;
        } else if (project.videoUrl) {
          const res = await extractVideoKeyframes(project.videoUrl, {
            maxFrames: 6,
            maxDimension: 480,
            targetDuration,
          });
          frames = res.frames;
        }
      }

      const response = await firstValueFrom(
        this.http.post<{
          language: string;
          hasSpeech: boolean;
          isVideoSilent: boolean;
          transcriptionSource: 'visual_analysis';
          visualAnalysis: VisualContentAnalysis;
          fullTranscript: string;
          captions: CaptionSegment[];
          notice?: string;
          error?: string;
        }>('/api/analyze-visual-content', {
          videoTitle: project.title,
          durationSeconds: targetDuration,
          videoFrames: frames,
        })
      );

      if (response?.error) {
        throw new Error(response.error);
      }

      const updatedProject: VideoCaptionProject = {
        ...project,
        language: response?.language || 'English',
        fullTranscript: response?.fullTranscript || '',
        captions: response?.captions || [],
        status: 'ready',
        hasSpeech: false,
        isVideoSilent: true,
        transcriptionSource: 'visual_analysis',
        visualAnalysis: response?.visualAnalysis,
        analysisNotice: response?.notice || 'Video content identified from visual scene analysis.',
      };

      this.activeCaptionProject.set(updatedProject);
      this.updateCaptionProjectInList(updatedProject);
    } catch (err: unknown) {
      console.error('Failed to analyze visual video content:', err);
      const message = extractApiError(err, 'Visual analysis failed. Starter captions generated.');
      this.errorMessage.set(message);

      const emergencyCaptions = this.createEmergencyCaptionSegments(project.title, project.durationSeconds);
      const fallbackProject: VideoCaptionProject = {
        ...project,
        status: 'ready',
        hasSpeech: false,
        isVideoSilent: true,
        transcriptionSource: 'visual_analysis',
        captions: emergencyCaptions,
        fullTranscript: project.title,
        analysisNotice: `${message} Subtitle placeholders have been generated for video duration.`,
      };
      this.activeCaptionProject.set(fallbackProject);
      this.updateCaptionProjectInList(fallbackProject);
    } finally {
      this.isSeparatingCaptions.set(false);
      this.captionExtractionProgress.set('');
    }
  }

  createEmergencyCaptionSegments(title?: string, durationSec = 45): CaptionSegment[] {
    const text = title ? `Video: ${title}` : 'Welcome to this video. Actionable tips and key takeaways.';
    const words = text.split(/\s+/).filter(Boolean);
    const wordsPerSegment = 5;
    const dur = durationSec > 0 ? durationSec : 45;
    const count = Math.max(3, Math.min(10, Math.ceil(dur / 4)));
    const segDur = dur / count;

    const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };

    const segments: CaptionSegment[] = [];
    for (let i = 0; i < count; i++) {
      const start = i * segDur;
      const end = Math.min((i + 1) * segDur, dur);
      const chunk = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment).join(' ');
      const label = chunk || (i === 0 ? 'Hook & introduction' : i === count - 1 ? 'Actionable wrap-up & CTA' : `Key point ${i}`);
      segments.push({
        id: `cap-${i + 1}-${Date.now().toString(36)}-${i}`,
        index: i + 1,
        startTime: formatTime(start),
        startSeconds: Number(start.toFixed(2)),
        endTime: formatTime(end),
        endSeconds: Number(end.toFixed(2)),
        text: label,
        speaker: 'Creator',
      });
    }
    return segments;
  }

  updateCaptionSegment(segmentId: string, updates: Partial<CaptionSegment>): void {
    const project = this.activeCaptionProject();
    if (!project) return;

    const updatedCaptions = project.captions.map((cap) => {
      if (cap.id === segmentId) {
        return { ...cap, ...updates };
      }
      return cap;
    });

    const fullTranscript = updatedCaptions.map((c) => c.text).join(' ');
    const updatedProject = { ...project, captions: updatedCaptions, fullTranscript };
    this.activeCaptionProject.set(updatedProject);
    this.updateCaptionProjectInList(updatedProject);
  }

  addCaptionSegment(afterIndex?: number): void {
    const project = this.activeCaptionProject();
    if (!project) return;

    const captions = [...project.captions];
    let newStart = 0;
    let insertAt = captions.length;

    if (typeof afterIndex === 'number' && afterIndex >= 0 && afterIndex < captions.length) {
      const prev = captions[afterIndex];
      newStart = prev.endSeconds;
      insertAt = afterIndex + 1;
    } else if (captions.length > 0) {
      newStart = captions[captions.length - 1].endSeconds;
    }

    const newEnd = newStart + 3.0;

    const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };

    const newCap: CaptionSegment = {
      id: `cap-new-${Date.now().toString(36)}`,
      index: insertAt + 1,
      startTime: formatTime(newStart),
      startSeconds: Number(newStart.toFixed(2)),
      endTime: formatTime(newEnd),
      endSeconds: Number(newEnd.toFixed(2)),
      text: 'New subtitle phrase here...',
    };

    captions.splice(insertAt, 0, newCap);

    // Re-index
    const reindexed = captions.map((c, idx) => ({ ...c, index: idx + 1 }));
    const updatedProject = {
      ...project,
      captions: reindexed,
      fullTranscript: reindexed.map((c) => c.text).join(' '),
    };
    this.activeCaptionProject.set(updatedProject);
    this.updateCaptionProjectInList(updatedProject);
  }

  removeCaptionSegment(segmentId: string): void {
    const project = this.activeCaptionProject();
    if (!project) return;

    const filtered = project.captions.filter((c) => c.id !== segmentId);
    const reindexed = filtered.map((c, idx) => ({ ...c, index: idx + 1 }));
    const updatedProject = {
      ...project,
      captions: reindexed,
      fullTranscript: reindexed.map((c) => c.text).join(' '),
    };
    this.activeCaptionProject.set(updatedProject);
    this.updateCaptionProjectInList(updatedProject);
  }

  shiftAllCaptions(deltaSec: number): void {
    const project = this.activeCaptionProject();
    if (!project) return;

    const formatTime = (sec: number) => {
      const clamped = Math.max(0, sec);
      const m = Math.floor(clamped / 60);
      const s = Math.floor(clamped % 60);
      const ms = Math.floor((clamped % 1) * 1000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };

    const shifted = project.captions.map((cap) => {
      const newStart = Math.max(0, cap.startSeconds + deltaSec);
      const duration = cap.endSeconds - cap.startSeconds;
      const newEnd = newStart + duration;

      return {
        ...cap,
        startSeconds: Number(newStart.toFixed(2)),
        startTime: formatTime(newStart),
        endSeconds: Number(newEnd.toFixed(2)),
        endTime: formatTime(newEnd),
      };
    });

    const updatedProject = { ...project, captions: shifted };
    this.activeCaptionProject.set(updatedProject);
    this.updateCaptionProjectInList(updatedProject);
  }

  exportCaptions(format: 'srt' | 'vtt' | 'txt'): void {
    const project = this.activeCaptionProject();
    if (!project || project.captions.length === 0) return;

    let content = '';
    let mimeType = 'text/plain';
    let fileExtension = 'txt';

    const formatSrtTime = (sec: number) => {
      const clamped = Math.max(0, sec);
      const h = Math.floor(clamped / 3600);
      const m = Math.floor((clamped % 3600) / 60);
      const s = Math.floor(clamped % 60);
      const ms = Math.floor((clamped % 1) * 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    const formatVttTime = (sec: number) => {
      const clamped = Math.max(0, sec);
      const m = Math.floor(clamped / 60);
      const s = Math.floor(clamped % 60);
      const ms = Math.floor((clamped % 1) * 1000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };

    if (format === 'srt') {
      mimeType = 'application/x-subrip';
      fileExtension = 'srt';
      content = project.captions
        .map((cap) => `${cap.index}\n${formatSrtTime(cap.startSeconds)} --> ${formatSrtTime(cap.endSeconds)}\n${cap.text}\n`)
        .join('\n');
    } else if (format === 'vtt') {
      mimeType = 'text/vtt';
      fileExtension = 'vtt';
      content =
        'WEBVTT\n\n' +
        project.captions
          .map((cap) => `${cap.index}\n${formatVttTime(cap.startSeconds)} --> ${formatVttTime(cap.endSeconds)}\n${cap.text}\n`)
          .join('\n');
    } else {
      content = project.fullTranscript || project.captions.map((c) => c.text).join('\n');
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_captions.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  sendCaptionsToSocialPackage(): void {
    const project = this.activeCaptionProject();
    if (!project) return;

    this.generateSocialPackage({
      videoTitle: project.title,
      videoDescription: project.fullTranscript || project.captions.map((c) => c.text).join(' '),
      keyPoints: project.captions.slice(0, 4).map((c) => c.text),
      keywords: project.title,
      tone: 'Engaging & Authentic',
    });
    this.activeTab.set('package');
  }

  loadDemoVideoProject(): void {
    const demoProject: VideoCaptionProject = {
      id: 'demo-proj-1',
      title: 'How I Automated My Content Workflow',
      fileName: 'creator_workflow_sample.mp4',
      fileSize: 5240000,
      videoUrl: '',
      durationSeconds: 24.5,
      language: 'English',
      captions: [
        {
          id: 'cap-1',
          index: 1,
          startTime: '00:00.000',
          startSeconds: 0.0,
          endTime: '00:03.400',
          endSeconds: 3.4,
          text: 'Most creators spend 8 hours making a single short-form video.',
          speaker: 'Creator',
        },
        {
          id: 'cap-2',
          index: 2,
          startTime: '00:03.400',
          startSeconds: 3.4,
          endTime: '00:07.100',
          endSeconds: 7.1,
          text: 'Here is the exact automated system I use to record 10 videos in 60 minutes.',
          speaker: 'Creator',
        },
        {
          id: 'cap-3',
          index: 3,
          startTime: '00:07.100',
          startSeconds: 7.1,
          endTime: '00:11.800',
          endSeconds: 11.8,
          text: 'Step 1: schedule your scenes and hooks before you ever hit the record button.',
          speaker: 'Creator',
        },
        {
          id: 'cap-4',
          index: 4,
          startTime: '00:11.800',
          startSeconds: 11.8,
          endTime: '00:16.200',
          endSeconds: 16.2,
          text: 'Step 2: upload your raw video directly into this studio to separate precise captions.',
          speaker: 'Creator',
        },
        {
          id: 'cap-5',
          index: 5,
          startTime: '00:16.200',
          startSeconds: 16.2,
          endTime: '00:20.500',
          endSeconds: 20.5,
          text: 'Step 3: instantly distribute the transcript to TikTok, LinkedIn, and Twitter.',
          speaker: 'Creator',
        },
        {
          id: 'cap-6',
          index: 6,
          startTime: '00:20.500',
          startSeconds: 20.5,
          endTime: '00:24.500',
          endSeconds: 24.5,
          text: 'Save this shoot checklist and start batching your videos today!',
          speaker: 'Creator',
        },
      ],
      fullTranscript:
        'Most creators spend 8 hours making a single short-form video. Here is the exact automated system I use to record 10 videos in 60 minutes. Step 1: schedule your scenes and hooks before you ever hit the record button. Step 2: upload your raw video directly into this studio to separate precise captions. Step 3: instantly distribute the transcript to TikTok, LinkedIn, and Twitter. Save this shoot checklist and start batching your videos today!',
      status: 'ready',
      createdAt: Date.now(),
    };

    this.activeCaptionProject.set(demoProject);
    const updated = [demoProject, ...this.captionProjects().filter((p) => p.id !== demoProject.id)];
    this.captionProjects.set(updated);
    this.persistCaptionProjects(updated);
  }

  loadDemoSilentVideoProject(): void {
    const demoSilentProject: VideoCaptionProject = {
      id: 'demo-silent-broll-1',
      title: 'Minimalist Desk Setup & Morning Coffee (Silent B-Roll)',
      fileName: 'aesthetic_desk_broll_silent.mp4',
      fileSize: 4120000,
      videoUrl: '',
      durationSeconds: 18.0,
      language: 'English',
      status: 'ready',
      hasSpeech: false,
      isVideoSilent: true,
      transcriptionSource: 'visual_analysis',
      visualAnalysis: {
        detectedTopic: 'Morning Creative Routine & Aesthetic Desk Architecture',
        category: 'Aesthetic B-Roll / Lifestyle',
        mood: 'Calm, focused, minimalist & cinematic',
        recommendedMusicVibe: 'Warm acoustic lofi beat with subtle rain textures (65-75 BPM)',
        visualActions: [
          'Opening shot: Steam gently rising from freshly brewed pour-over coffee beside a mechanical keyboard',
          'Cinematic overhead pan across minimalist walnut desk mat, tablet with stylus, and ambient monitor lightbar',
          'Close-up focus racking: Hands typing smooth code snippets on custom matte keycaps',
          'Final establishing frame: Sipping warm coffee while looking out morning sunlit window',
        ],
        suggestedVoiceover:
          'This is how I set up my space before writing a single line of code. No phone, natural morning light, and a hot pour-over. When your environment is uncluttered, deep focus follows naturally.',
      },
      captions: [
        {
          id: 'cap-sb-1',
          index: 1,
          startTime: '00:00.000',
          startSeconds: 0.0,
          endTime: '00:04.200',
          endSeconds: 4.2,
          text: 'Fresh morning pour-over coffee brewing.',
          speaker: 'Visual Cue',
        },
        {
          id: 'cap-sb-2',
          index: 2,
          startTime: '00:04.200',
          startSeconds: 4.2,
          endTime: '00:08.500',
          endSeconds: 8.5,
          text: 'Minimalist workspace with warm ambient lighting.',
          speaker: 'Visual Cue',
        },
        {
          id: 'cap-sb-3',
          index: 3,
          startTime: '00:08.500',
          startSeconds: 8.5,
          endTime: '00:13.200',
          endSeconds: 13.2,
          text: 'Mechanical keyboard & deep uninterrupted flow state.',
          speaker: 'Visual Cue',
        },
        {
          id: 'cap-sb-4',
          index: 4,
          startTime: '00:13.200',
          startSeconds: 13.2,
          endTime: '00:18.000',
          endSeconds: 18.0,
          text: 'Clarity starts with an intentional creative environment.',
          speaker: 'Visual Cue',
        },
      ],
      fullTranscript:
        'Fresh morning pour-over coffee brewing. Minimalist workspace with warm ambient lighting. Mechanical keyboard & deep uninterrupted flow state. Clarity starts with an intentional creative environment.',
      analysisNotice: 'Silent video detected. Visual scenes, actions, and aesthetic subtitles analyzed with Gemini Vision.',
      createdAt: Date.now(),
    };

    this.activeCaptionProject.set(demoSilentProject);
    const updated = [demoSilentProject, ...this.captionProjects().filter((p) => p.id !== demoSilentProject.id)];
    this.captionProjects.set(updated);
    this.persistCaptionProjects(updated);
  }

  private persistCaptionProjects(projects: VideoCaptionProject[]): void {
    // Strip temporary local object URLs (blob:...) which expire upon session close
    const serializable = projects.map((p) => ({
      ...p,
      videoUrl: p.videoUrl && p.videoUrl.startsWith('blob:') ? undefined : p.videoUrl,
    }));
    this.persistToStorage(STORAGE_CAPTION_PROJECTS, serializable);
  }

  private updateCaptionProjectInList(project: VideoCaptionProject): void {
    const list = this.captionProjects();
    const filtered = list.filter((p) => p.id !== project.id);
    const updated = [project, ...filtered];
    this.captionProjects.set(updated);
    this.persistCaptionProjects(updated);
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      const savedIdeasJson = localStorage.getItem(STORAGE_SAVED_IDEAS);
      if (savedIdeasJson) {
        this.savedIdeas.set(JSON.parse(savedIdeasJson));
      }

      const savedPackagesJson = localStorage.getItem(STORAGE_SAVED_PACKAGES);
      if (savedPackagesJson) {
        this.savedPackages.set(JSON.parse(savedPackagesJson));
      }

      const savedSchedulesJson = localStorage.getItem(STORAGE_SCHEDULES);
      if (savedSchedulesJson) {
        const parsed = JSON.parse(savedSchedulesJson);
        this.schedules.set(parsed);
        if (parsed.length > 0) {
          this.selectedSchedule.set(parsed[0]);
        }
      } else {
        // Seed realistic schedules for initial experience
        const initial = this.getInitialSchedules();
        this.schedules.set(initial);
        this.selectedSchedule.set(initial[0]);
        this.persistToStorage(STORAGE_SCHEDULES, initial);
      }

      const savedCaptionsJson = localStorage.getItem(STORAGE_CAPTION_PROJECTS);
      if (savedCaptionsJson) {
        const parsedCaptions: VideoCaptionProject[] = JSON.parse(savedCaptionsJson);
        // Clear expired blob URLs from prior browser tabs so video player does not crash
        const sanitized = parsedCaptions.map((p) => ({
          ...p,
          videoUrl: p.videoUrl && p.videoUrl.startsWith('blob:') ? undefined : p.videoUrl,
        }));
        this.captionProjects.set(sanitized);
        if (sanitized.length > 0) {
          this.activeCaptionProject.set(sanitized[0]);
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage', e);
    }
  }

  private getInitialSchedules(): VideoShootSchedule[] {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    return [
      {
        id: 'sched-1',
        title: 'How I 10x Content Output with AI Systems',
        conceptSummary: 'Behind-the-scenes walkthrough of batch filming and automated social post creation.',
        shootDate: today,
        shootTime: '14:30',
        location: 'Studio Desk Setup',
        format: '9:16 Reel / Short',
        targetDuration: '60s',
        status: 'filming',
        equipmentChecklist: [
          { id: 'eq-1', name: '4K Camera / Smartphone at eye level', checked: true },
          { id: 'eq-2', name: 'Wireless lavalier mic pinned to collar', checked: true },
          { id: 'eq-3', name: 'Soft key light at 5600K 45° angle', checked: true },
          { id: 'eq-4', name: 'Clean desk background & minimal clutter', checked: false },
          { id: 'eq-5', name: 'Teleprompter talking points loaded', checked: true },
        ],
        scenes: [
          {
            id: 'sc-1',
            title: 'Scene 1: Pattern Interrupt Hook',
            description: 'Look directly at camera. "Most creators spend 8 hours making one video. Here is how I make 10 in 1 hour."',
            durationSec: 5,
            visualNotes: 'Close-up head shot, tight crop, fast zoom-in',
            isCompleted: true,
          },
          {
            id: 'sc-2',
            title: 'Scene 2: Core Friction & The System',
            description: 'Explain why batching script hooks upfront saves 80% of editing friction.',
            durationSec: 20,
            visualNotes: 'Medium shot with desk gesture',
            isCompleted: false,
          },
          {
            id: 'sc-3',
            title: 'Scene 3: Live Screen Demonstration',
            description: 'Show computer screen extracting separated captions and social carousels automatically.',
            durationSec: 25,
            visualNotes: 'Over-the-shoulder b-roll or screen capture',
            isCompleted: false,
          },
          {
            id: 'sc-4',
            title: 'Scene 4: Punchy Call to Action',
            description: 'Wrap up with direct question: "Drop \'WORKFLOW\' below and I will send you my shoot checklist."',
            durationSec: 10,
            visualNotes: 'Direct eye contact, gesture to comment box',
            isCompleted: false,
          },
        ],
        notes: 'Record two hook takes (one energetic, one whispering intrigue). Keep lighting soft.',
        createdAt: Date.now() - 3600000,
      },
      {
        id: 'sched-2',
        title: '5 Costly Creator Mistakes That Kill Retention in 3 Seconds',
        conceptSummary: 'Analyzing why viewers swipe away and how to fix your first 3 seconds.',
        shootDate: tomorrow,
        shootTime: '10:00',
        location: 'Home Office Standing Setup',
        format: 'Talking Head + B-Roll',
        targetDuration: '45s',
        status: 'planned',
        equipmentChecklist: [
          { id: 'eq-201', name: 'Camera battery 100% & empty SD card', checked: false },
          { id: 'eq-202', name: 'Ring light + hair rim light turned on', checked: false },
          { id: 'eq-203', name: 'Wireless audio transmitter paired', checked: false },
          { id: 'eq-204', name: 'Visual prop (red buzzer / whiteboard)', checked: false },
        ],
        scenes: [
          {
            id: 'sc-201',
            title: 'Scene 1: Mistake Hook',
            description: '"Stop starting your videos with \'Hey guys, so today...\'. It kills 60% of your views."',
            durationSec: 4,
            visualNotes: 'Bold text overlay, punch-in effect',
            isCompleted: false,
          },
          {
            id: 'sc-202',
            title: 'Scene 2: Retention Curve Breakdown',
            description: 'Point to floating retention graph chart showing drop-off.',
            durationSec: 18,
            visualNotes: 'Medium framing with screen graphic',
            isCompleted: false,
          },
          {
            id: 'sc-203',
            title: 'Scene 3: The 3-Second Fix',
            description: 'Deliver the 3-step solution: Visual movement, Question, Value promise.',
            durationSec: 15,
            visualNotes: 'Rapid 1-2-3 fingers gesture',
            isCompleted: false,
          },
          {
            id: 'sc-204',
            title: 'Scene 4: Actionable CTA',
            description: '"Save this for your next recording session."',
            durationSec: 8,
            visualNotes: 'Bookmark icon animation prompt',
            isCompleted: false,
          },
        ],
        notes: 'Wear contrasting dark shirt against neutral wall.',
        createdAt: Date.now() - 7200000,
      },
    ];
  }


  private persistToStorage(key: string, data: unknown): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not write to localStorage', e);
    }
  }
}
