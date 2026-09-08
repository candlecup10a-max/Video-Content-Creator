import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {ContentCreator} from '../services/content-creator';
import {VideoIdea} from '../models/content.models';

interface InspirationPrompt {
  label: string;
  keywords: string;
  niche: string;
  tone: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-idea-generator',
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <section class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <!-- Intro / Question Header -->
      <div class="text-center max-w-2xl mx-auto space-y-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 mb-1">
          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">psychology</mat-icon>
          Step 1: Ideation & Video Scripting
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
          What kind of video do you want to create?
        </h2>
        <p class="text-stone-600 text-sm sm:text-base leading-relaxed">
          Stuck on ideas? Give a few keywords or themes below. We'll generate scroll-stopping video concepts, viral hooks, and complete script outlines.
        </p>
      </div>

      <!-- Brainstorm Form Card -->
      <div class="bg-white rounded-2xl p-5 sm:p-7 border border-stone-200 shadow-xs space-y-6">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-5">
          <!-- Main Keywords Input -->
          <div>
            <label for="keywords-input" class="block text-sm font-semibold text-stone-900 mb-1.5">
              Enter keywords, topics, or what you feel like talking about
              <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <input
                id="keywords-input"
                type="text"
                formControlName="keywords"
                placeholder="e.g. Remote work productivity, morning routine mistakes, fitness for beginners..."
                class="w-full px-4 py-3 sm:py-3.5 pl-11 rounded-xl border border-stone-300 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-900 placeholder:text-stone-400 text-sm sm:text-base transition-all outline-none"
              />
              <mat-icon class="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 !w-5 !h-5 !text-[20px]">
                search
              </mat-icon>
            </div>
          </div>

          <!-- Quick Inspiration Chips -->
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-2">
              Or pick an instant keyword prompt:
            </span>
            <div class="flex flex-wrap gap-2">
              @for (preset of presets; track preset.label) {
                <button
                  type="button"
                  [id]="'preset-' + preset.label.toLowerCase().replace(' ', '-')"
                  (click)="applyPreset(preset)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 text-stone-700 hover:bg-stone-200/80 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  <span>{{ preset.label }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Additional Preferences Grid -->
          <div class="pt-2 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Tone / Vibe -->
            <div>
              <label for="tone-select" class="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Tone & Vibe
              </label>
              <select
                id="tone-select"
                formControlName="tone"
                class="w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-800 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none bg-white"
              >
                <option value="Engaging & High Energy">⚡ High Energy & Catchy</option>
                <option value="Authentic & Storytelling">📖 Storytelling & Relatable</option>
                <option value="Authoritative & Educational">🎓 Educational & Expert</option>
                <option value="Contrarian & Myth-Busting">💥 Myth-Busting & Bold</option>
                <option value="Casual & Humorous">😄 Casual & Humorous</option>
              </select>
            </div>

            <!-- Video Length -->
            <div>
              <label for="length-select" class="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Video Format & Length
              </label>
              <select
                id="length-select"
                formControlName="targetLength"
                class="w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-800 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none bg-white"
              >
                <option value="Short-form (30-60s) for TikTok/Reels/Shorts">📱 Short-form (30–60s) Reel/TikTok</option>
                <option value="Micro-hook (15-30s) rapid fire">⚡ Micro-hook (15–30s)</option>
                <option value="Medium depth (2-4 min)">🎥 Medium depth (2–4 min)</option>
                <option value="Comprehensive Breakdown (5-10 min)">🎙️ Deep Dive (5–10 min)</option>
              </select>
            </div>

            <!-- Target Audience -->
            <div>
              <label for="audience-select" class="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Target Audience
              </label>
              <select
                id="audience-select"
                formControlName="targetAudience"
                class="w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-800 text-xs sm:text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none bg-white"
              >
                <option value="Curious beginners & general social audience">👥 Beginners & General Audience</option>
                <option value="Professionals, founders & career seekers">💼 Working Professionals & Founders</option>
                <option value="Tech enthusiasts & creators">💻 Creators & Digital Enthusiasts</option>
                <option value="Busy individuals looking for fast tips">⏱️ Busy People Wanting Fast Results</option>
              </select>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-2 flex items-center justify-between gap-4">
            <span class="text-xs text-stone-600 hidden sm:inline">
              Gemini will generate 4–5 structured video concepts with word-for-word hooks and outlines.
            </span>
            <button
              id="submit-generate-ideas-btn"
              type="submit"
              [disabled]="form.invalid || service.isGeneratingIdeas()"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              @if (service.isGeneratingIdeas()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Brainstorming Concepts...</span>
              } @else {
                <mat-icon class="!w-4 !h-4 !text-[18px] text-amber-400">auto_awesome</mat-icon>
                <span>Brainstorm Video Ideas</span>
              }
            </button>
          </div>
        </form>
      </div>

      <!-- Error Message Banner -->
      @if (service.errorMessage() && service.activeTab() === 'ideation') {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-start gap-3">
            <mat-icon class="text-rose-600 shrink-0 mt-0.5">error_outline</mat-icon>
            <div class="space-y-1">
              <p class="font-semibold">Unable to generate ideas</p>
              <p class="text-xs text-rose-700 leading-relaxed">{{ service.errorMessage() }}</p>
            </div>
          </div>
          <button
            id="retry-ideas-btn"
            type="button"
            (click)="onSubmit()"
            [disabled]="service.isGeneratingIdeas() || form.invalid"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">refresh</mat-icon>
            <span>Retry</span>
          </button>
        </div>
      }

      <!-- Loading State Skeleton -->
      @if (service.isGeneratingIdeas()) {
        <div class="space-y-4 pt-4">
          <div class="flex items-center justify-center gap-3 py-10">
            <div class="w-6 h-6 border-3 border-stone-300 border-t-stone-900 rounded-full animate-spin"></div>
            <p class="text-sm font-medium text-stone-600 animate-pulse">
              Gemini is researching high-retention angles and crafting viral hooks...
            </p>
          </div>
        </div>
      }

      <!-- Generated Video Ideas Section -->
      @if (!service.isGeneratingIdeas() && service.ideas().length > 0) {
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
            <div>
              <h3 class="text-lg font-bold text-stone-900">
                Generated Video Concepts ({{ service.ideas().length }})
              </h3>
              <p class="text-xs text-stone-500">
                Pick a concept to view its script outline, save it, or turn it directly into ready-to-publish social posts.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                id="re-brainstorm-btn"
                type="button"
                (click)="onSubmit()"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 text-xs font-medium transition-colors cursor-pointer"
              >
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">refresh</mat-icon>
                <span>Regenerate Fresh Ideas</span>
              </button>
            </div>
          </div>

          <!-- Video Ideas Cards Grid -->
          <div class="grid grid-cols-1 gap-6">
            @for (idea of service.ideas(); track idea.id; let i = $index) {
              <article
                [id]="'idea-card-' + i"
                class="bg-white rounded-2xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all overflow-hidden"
              >
                <!-- Card Header with Hook Banner -->
                <div class="p-5 sm:p-6 space-y-4">
                  <!-- Badges & Format -->
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900">
                        Idea #{{ i + 1 }}
                      </span>
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-700">
                        <mat-icon class="!w-3 !h-3 !text-[12px]">movie</mat-icon>
                        {{ idea.format }}
                      </span>
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-700">
                        <mat-icon class="!w-3 !h-3 !text-[12px]">schedule</mat-icon>
                        {{ idea.estimatedDuration }}
                      </span>
                    </div>

                    <!-- Bookmark / Save Button -->
                    <button
                      type="button"
                      [id]="'toggle-save-idea-' + i"
                      (click)="onToggleSave(idea)"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      [class]="service.isIdeaSaved(idea.id) ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'text-stone-500 hover:bg-stone-100'"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">
                        {{ service.isIdeaSaved(idea.id) ? 'bookmark' : 'bookmark_border' }}
                      </mat-icon>
                      <span>{{ service.isIdeaSaved(idea.id) ? 'Saved' : 'Save' }}</span>
                    </button>
                  </div>

                  <!-- Title -->
                  <h4 class="text-xl font-bold text-stone-900 leading-snug">
                    {{ idea.title }}
                  </h4>

                  <!-- The Hook Box (Crucial for video creators) -->
                  <div class="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-1">
                    <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">flash_on</mat-icon>
                      Opening 3-Second Hook
                    </div>
                    <p class="text-sm font-medium text-stone-900 italic">
                      "{{ idea.hook }}"
                    </p>
                  </div>

                  <!-- Concept Summary -->
                  <p class="text-sm text-stone-600 leading-relaxed">
                    {{ idea.conceptSummary }}
                  </p>

                  <!-- Virality / Psychology Trigger -->
                  <div class="flex items-start gap-2 p-2.5 rounded-lg bg-stone-50 text-xs text-stone-600">
                    <mat-icon class="!w-4 !h-4 !text-[16px] text-emerald-600 shrink-0 mt-0.5">trending_up</mat-icon>
                    <div>
                      <strong class="font-semibold text-stone-800">Why it works:</strong>
                      {{ idea.whyItWorks }}
                    </div>
                  </div>

                  <!-- Key Takeaways -->
                  @if (idea.keyTakeaways && idea.keyTakeaways.length > 0) {
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-xs font-medium text-stone-600">Takeaways:</span>
                      @for (tag of idea.keyTakeaways; track tag) {
                        <span class="px-2 py-0.5 rounded-md text-[11px] bg-stone-100 text-stone-700 font-medium">
                          {{ tag }}
                        </span>
                      }
                    </div>
                  }
                </div>

                <!-- Expandable Script Outline -->
                <div class="border-t border-stone-100 bg-stone-50/50 p-4 sm:p-5">
                  <div class="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      [id]="'toggle-outline-' + i"
                      (click)="toggleOutline(idea.id)"
                      class="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 cursor-pointer"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">
                        {{ expandedOutlines().has(idea.id) ? 'expand_less' : 'expand_more' }}
                      </mat-icon>
                      <span>
                        {{ expandedOutlines().has(idea.id) ? 'Hide Script Outline' : 'View Full Script Outline & Shots' }}
                      </span>
                    </button>

                    <button
                      type="button"
                      [id]="'copy-outline-' + i"
                      (click)="copyOutline(idea)"
                      class="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                        {{ copiedOutlineId() === idea.id ? 'check' : 'content_copy' }}
                      </mat-icon>
                      <span>{{ copiedOutlineId() === idea.id ? 'Copied!' : 'Copy Script' }}</span>
                    </button>
                  </div>

                  <!-- Expanded Script Breakdown -->
                  @if (expandedOutlines().has(idea.id)) {
                    <div class="space-y-3 pt-2">
                      @for (section of idea.outline; track section.timing) {
                        <div class="p-3 rounded-xl bg-white border border-stone-200/80 space-y-1.5 text-xs">
                          <div class="flex items-center justify-between text-stone-600 font-semibold">
                            <span class="text-stone-900 font-bold">{{ section.title }}</span>
                            <span class="px-1.5 py-0.5 rounded bg-stone-100 text-[10px] font-mono">{{ section.timing }}</span>
                          </div>
                          <p class="text-stone-800 leading-relaxed">
                            <strong class="text-stone-900">Script / Action:</strong> {{ section.script }}
                          </p>
                          <p class="text-stone-500 italic">
                            <strong class="text-stone-600 not-italic">Visual cue:</strong> {{ section.visual }}
                          </p>
                        </div>
                      }

                      @if (idea.callToAction) {
                        <div class="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900">
                          <strong>Call to Action:</strong> {{ idea.callToAction }}
                        </div>
                      }
                    </div>
                  }

                  <!-- Action Buttons: Schedule Shoot & Move to Social Posts -->
                  <div class="mt-4 pt-3 border-t border-stone-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div class="text-xs text-stone-500">
                      Ready to film this? Schedule the shoot date or generate posts.
                    </div>
                    <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        [id]="'schedule-shoot-for-idea-' + i"
                        (click)="service.scheduleFromIdea(idea)"
                        class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer"
                        title="Add to your filming calendar & prepare gear checklist"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-emerald-600">calendar_month</mat-icon>
                        <span>Schedule Shoot</span>
                      </button>

                      <button
                        type="button"
                        [id]="'create-posts-for-idea-' + i"
                        (click)="useIdeaForPackaging(idea)"
                        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-400">send</mat-icon>
                        <span>Create Social Posts</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class IdeaGenerator {
  readonly service = inject(ContentCreator);

  readonly expandedOutlines = signal<Set<string>>(new Set<string>());
  readonly copiedOutlineId = signal<string | null>(null);

  readonly presets: InspirationPrompt[] = [
    {
      label: '⚡ Productivity Hacks',
      keywords: 'Remote work productivity hacks, time blocking mistakes, energy management',
      niche: 'Productivity & Tech',
      tone: 'Engaging & High Energy',
    },
    {
      label: '💰 Money Traps in 20s',
      keywords: 'Personal finance mistakes in your 20s, lifestyle inflation, compound interest myth',
      niche: 'Finance & Career',
      tone: 'Contrarian & Myth-Busting',
    },
    {
      label: '🤖 AI Tools That Save Hours',
      keywords: 'Hidden AI tools replacing boring tasks, automation for everyday life',
      niche: 'Technology',
      tone: 'Authoritative & Educational',
    },
    {
      label: '🏋️ 15-Min Quick Workout',
      keywords: 'Zero equipment home workout for busy people, form mistakes to avoid',
      niche: 'Health & Fitness',
      tone: 'Casual & Humorous',
    },
    {
      label: '☕ Morning Routine Reality',
      keywords: 'Over-complicated morning routines vs what actually works, realistic habits',
      niche: 'Lifestyle & Wellness',
      tone: 'Authentic & Storytelling',
    },
  ];

  readonly form = new FormGroup({
    keywords: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    tone: new FormControl<string>('Engaging & High Energy', {nonNullable: true}),
    targetLength: new FormControl<string>('Short-form (30-60s) for TikTok/Reels/Shorts', {nonNullable: true}),
    targetAudience: new FormControl<string>('Curious beginners & general social audience', {nonNullable: true}),
    niche: new FormControl<string>('Content Creator / General', {nonNullable: true}),
  });

  applyPreset(preset: InspirationPrompt): void {
    this.form.patchValue({
      keywords: preset.keywords,
      niche: preset.niche,
      tone: preset.tone,
    });
    this.onSubmit();
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    this.service.generateIdeas({
      keywords: values.keywords,
      tone: values.tone,
      targetLength: values.targetLength,
      targetAudience: values.targetAudience,
      niche: values.niche,
    });
  }

  toggleOutline(id: string): void {
    const current = new Set(this.expandedOutlines());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedOutlines.set(current);
  }

  onToggleSave(idea: VideoIdea): void {
    this.service.toggleSaveIdea(idea);
  }

  async copyOutline(idea: VideoIdea): Promise<void> {
    const text = `VIDEO IDEA: ${idea.title}
FORMAT: ${idea.format} (${idea.estimatedDuration})
OPENING HOOK: "${idea.hook}"

OUTLINE:
${idea.outline.map((s) => `[${s.timing}] ${s.title}\nScript: ${s.script}\nVisual: ${s.visual}\n`).join('\n')}

CALL TO ACTION: ${idea.callToAction}
WHY IT WORKS: ${idea.whyItWorks}`;

    try {
      await navigator.clipboard.writeText(text);
      this.copiedOutlineId.set(idea.id);
      setTimeout(() => this.copiedOutlineId.set(null), 2000);
    } catch (e) {
      console.error('Could not copy to clipboard', e);
    }
  }

  useIdeaForPackaging(idea: VideoIdea): void {
    this.service.selectIdeaForPackaging(idea);
  }
}
