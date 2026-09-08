import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ContentCreator} from '../services/content-creator';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-saved-library',
  imports: [MatIconModule],
  template: `
    <section class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div class="text-center max-w-2xl mx-auto space-y-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 mb-1">
          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">bookmark</mat-icon>
          Saved Content Library
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
          Your Saved Concepts & Packages
        </h2>
        <p class="text-stone-600 text-sm sm:text-base">
          All your bookmarked video ideas and prepared multi-platform social media posts in one place.
        </p>
      </div>

      <!-- Sub-Tabs: Saved Ideas vs Saved Social Packages -->
      <div class="flex items-center justify-center gap-2">
        <button
          type="button"
          id="tab-saved-ideas"
          (click)="librarySubTab.set('ideas')"
          [class]="librarySubTab() === 'ideas' ? 'bg-stone-900 text-white font-semibold' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-2xs"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-400">lightbulb</mat-icon>
          <span>Saved Video Ideas ({{ service.savedIdeas().length }})</span>
        </button>

        <button
          type="button"
          id="tab-saved-packages"
          (click)="librarySubTab.set('packages')"
          [class]="librarySubTab() === 'packages' ? 'bg-stone-900 text-white font-semibold' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-2xs"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-400">share</mat-icon>
          <span>Social Packages ({{ service.savedPackages().length }})</span>
        </button>
      </div>

      <!-- Content Views -->
      @if (librarySubTab() === 'ideas') {
        @if (service.savedIdeas().length === 0) {
          <div class="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-3">
            <mat-icon class="!w-12 !h-12 !text-[48px] text-stone-300 mx-auto">lightbulb_outline</mat-icon>
            <h4 class="font-bold text-stone-800 text-base">No Saved Video Ideas Yet</h4>
            <p class="text-xs text-stone-500 max-w-sm mx-auto">
              Brainstorm some video ideas in Step 1 and bookmark the concepts you love to store them here.
            </p>
            <button
              type="button"
              id="goto-ideation-btn"
              (click)="service.setTab('ideation')"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">add</mat-icon>
              <span>Brainstorm Ideas Now</span>
            </button>
          </div>
        } @else {
          <div class="space-y-4">
            @for (idea of service.savedIdeas(); track idea.id; let idx = $index) {
              <div
                [id]="'saved-idea-' + idx"
                class="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 mb-1">
                      {{ idea.format }} • {{ idea.estimatedDuration }}
                    </span>
                    <h4 class="text-base sm:text-lg font-bold text-stone-900 leading-snug">
                      {{ idea.title }}
                    </h4>
                  </div>

                  <button
                    type="button"
                    [id]="'delete-saved-idea-' + idx"
                    (click)="service.deleteSavedIdea(idea.id)"
                    class="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove from saved"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[18px]">delete_outline</mat-icon>
                  </button>
                </div>

                <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                  <span class="font-bold text-amber-900">Hook:</span>
                  <span class="italic text-stone-800 ml-1">"{{ idea.hook }}"</span>
                </div>

                <p class="text-xs text-stone-600 leading-relaxed">
                  {{ idea.conceptSummary }}
                </p>

                <div class="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                  <span class="text-[11px] text-stone-400">
                    Why it works: {{ idea.whyItWorks }}
                  </span>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      [id]="'schedule-saved-idea-' + idx"
                      (click)="service.scheduleFromIdea(idea)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                      title="Schedule a video shoot for this idea"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-emerald-600">calendar_today</mat-icon>
                      <span>Schedule Shoot</span>
                    </button>

                    <button
                      type="button"
                      [id]="'load-saved-idea-' + idx"
                      (click)="service.selectIdeaForPackaging(idea)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-amber-400">arrow_forward</mat-icon>
                      <span>Create Posts</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      }

      @if (librarySubTab() === 'packages') {
        @if (service.savedPackages().length === 0) {
          <div class="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-3">
            <mat-icon class="!w-12 !h-12 !text-[48px] text-stone-300 mx-auto">share</mat-icon>
            <h4 class="font-bold text-stone-800 text-base">No Saved Social Packages</h4>
            <p class="text-xs text-stone-500 max-w-sm mx-auto">
              When you generate multi-platform social posts in Step 2, click "Save to Library" to keep them here for reference.
            </p>
            <button
              type="button"
              id="goto-package-btn"
              (click)="service.setTab('package')"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">arrow_forward</mat-icon>
              <span>Go to Social Posts</span>
            </button>
          </div>
        } @else {
          <div class="space-y-4">
            @for (pkg of service.savedPackages(); track pkg.id; let idx = $index) {
              <div
                [id]="'saved-pkg-' + idx"
                class="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <span class="text-[11px] text-stone-400 font-medium block">
                      Saved package • {{ formatDate(pkg.createdAt) }}
                    </span>
                    <h4 class="text-base sm:text-lg font-bold text-stone-900 leading-snug">
                      {{ pkg.videoTitle }}
                    </h4>
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      [id]="'open-saved-pkg-' + idx"
                      (click)="service.loadSavedPackage(pkg)"
                      class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                      <span>Open Package</span>
                    </button>
                    <button
                      type="button"
                      [id]="'delete-saved-pkg-' + idx"
                      (click)="service.deleteSavedPackage(pkg.id)"
                      class="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete package"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[18px]">delete_outline</mat-icon>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div class="p-2 rounded-lg bg-stone-50 border border-stone-100">
                    <span class="font-bold text-stone-900 block">TikTok</span>
                    <span class="text-stone-500 truncate block">{{ pkg.posts.tiktok.caption || 'Ready' }}</span>
                  </div>
                  <div class="p-2 rounded-lg bg-stone-50 border border-stone-100">
                    <span class="font-bold text-blue-700 block">LinkedIn</span>
                    <span class="text-stone-500 truncate block">{{ pkg.posts.linkedin.hook || 'Ready' }}</span>
                  </div>
                  <div class="p-2 rounded-lg bg-stone-50 border border-stone-100">
                    <span class="font-bold text-sky-600 block">Twitter / X</span>
                    <span class="text-stone-500 truncate block">{{ pkg.posts.twitter.mainTweet || 'Ready' }}</span>
                  </div>
                  <div class="p-2 rounded-lg bg-stone-50 border border-stone-100">
                    <span class="font-bold text-blue-800 block">Facebook</span>
                    <span class="text-stone-500 truncate block">{{ pkg.posts.facebook.fullPost.slice(0, 30) }}...</span>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      }
    </section>
  `,
})
export class SavedLibrary {
  readonly service = inject(ContentCreator);
  readonly librarySubTab = signal<'ideas' | 'packages'>('ideas');

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
