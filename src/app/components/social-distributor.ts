import {ChangeDetectionStrategy, Component, effect, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {ContentCreator} from '../services/content-creator';
import {ActivePlatformTab, SocialPackage} from '../models/content.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-social-distributor',
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <!-- Header -->
      <div class="text-center max-w-2xl mx-auto space-y-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-900 mb-1">
          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">share</mat-icon>
          Step 2: Multi-Platform Social Packaging
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
          Publish Your Video Across All Platforms
        </h2>
        <p class="text-stone-600 text-sm sm:text-base leading-relaxed">
          Prepare optimized titles, captions, hashtags, and native posts tailored for TikTok, LinkedIn, Twitter/X, and Facebook.
        </p>
      </div>

      <!-- Source Idea Banner (If loaded from Step 1) -->
      @if (service.selectedIdea()) {
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div class="flex items-start gap-3">
            <mat-icon class="text-amber-700 mt-0.5 shrink-0">movie_filter</mat-icon>
            <div>
              <p class="font-bold text-amber-950">
                Loaded from brainstormed idea: "{{ service.selectedIdea()?.title }}"
              </p>
              <p class="text-xs text-amber-800">
                Hook: "{{ service.selectedIdea()?.hook }}"
              </p>
            </div>
          </div>
          <button
            type="button"
            id="clear-selected-idea-btn"
            (click)="clearSelectedIdea()"
            class="text-xs text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer"
          >
            Switch to custom video
          </button>
        </div>
      }

      <!-- Video Details Input Form -->
      <div class="bg-white rounded-2xl p-5 sm:p-7 border border-stone-200 shadow-xs space-y-5">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-2">
              <label for="video-title-input" class="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Video Title or Topic <span class="text-rose-500">*</span>
              </label>
              <input
                id="video-title-input"
                type="text"
                formControlName="videoTitle"
                placeholder="e.g. 3 Productivity Habits That Changed My Life"
                class="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-stone-900 text-sm outline-none"
              />
            </div>

            <div>
              <label for="video-tone-select" class="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Tone & Voice
              </label>
              <select
                id="video-tone-select"
                formControlName="tone"
                class="w-full px-3 py-2.5 rounded-xl border border-stone-300 focus:border-stone-900 text-stone-900 text-sm outline-none bg-white"
              >
                <option value="Engaging, authoritative & conversational">🌟 Engaging & Authoritative</option>
                <option value="Story-driven, vulnerable & authentic">📖 Story-driven & Authentic</option>
                <option value="Fast-paced, bold & witty">⚡ Bold, Punchy & Witty</option>
                <option value="Professional, actionable & polished">💼 Professional & High-Value</option>
              </select>
            </div>
          </div>

          <div>
            <label for="video-desc-input" class="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
              What is in the video? (Key points, steps, story, or summary) <span class="text-rose-500">*</span>
            </label>
            <textarea
              id="video-desc-input"
              rows="3"
              formControlName="videoDescription"
              placeholder="e.g. In this video, I explain why waking up at 5am doesn't guarantee success. The 3 main points are: 1) Energy management beats time management, 2) The 90-minute focus block method, 3) Ruthlessly eliminating low-value notifications."
              class="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-stone-900 text-sm outline-none resize-y"
            ></textarea>
          </div>

          <!-- Submit Button -->
          <div class="flex items-center justify-between pt-2">
            <span class="text-xs text-stone-500 hidden sm:inline">
              Creates tailored posts for LinkedIn, Facebook, TikTok, Twitter, plus 5 titles, hashtags & captions.
            </span>
            <button
              id="generate-package-btn"
              type="submit"
              [disabled]="form.invalid || service.isGeneratingPackage()"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              @if (service.isGeneratingPackage()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Crafting Social Media Package...</span>
              } @else {
                <mat-icon class="!w-4 !h-4 !text-[18px] text-amber-400">rocket_launch</mat-icon>
                <span>Generate Social Media Package</span>
              }
            </button>
          </div>
        </form>
      </div>

      <!-- Error State -->
      @if (service.errorMessage() && service.activeTab() === 'package') {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-start gap-3">
            <mat-icon class="text-rose-600 shrink-0 mt-0.5">error_outline</mat-icon>
            <div>
              <p class="font-semibold">Unable to generate social package</p>
              <p class="text-xs text-rose-700 leading-relaxed">{{ service.errorMessage() }}</p>
            </div>
          </div>
          <button
            id="retry-package-btn"
            type="button"
            (click)="onSubmit()"
            [disabled]="service.isGeneratingPackage() || form.invalid"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">refresh</mat-icon>
            <span>Retry</span>
          </button>
        </div>
      }

      <!-- Loading Skeleton -->
      @if (service.isGeneratingPackage()) {
        <div class="py-12 flex flex-col items-center justify-center gap-3">
          <div class="w-8 h-8 border-3 border-stone-300 border-t-stone-900 rounded-full animate-spin"></div>
          <p class="text-sm font-semibold text-stone-700 animate-pulse">
            Gemini is writing native posts for LinkedIn, Facebook, TikTok, and Twitter...
          </p>
          <p class="text-xs text-stone-500">
            Optimizing character limits, formatting hooks, and curating hashtag clusters.
          </p>
        </div>
      }

      <!-- Generated Social Package Workspace -->
      @if (!service.isGeneratingPackage() && service.currentPackage(); as pkg) {
        <div class="space-y-8">
          <!-- Package Header Controls -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-stone-200">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-stone-900 text-base sm:text-lg">
                  Social Distribution Package
                </h3>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                  Ready to Publish
                </span>
              </div>
              <p class="text-xs text-stone-500">
                Video: "{{ pkg.videoTitle }}"
              </p>
            </div>

            <!-- Global Actions -->
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="save-package-btn"
                (click)="savePackage()"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px] text-rose-500">bookmark</mat-icon>
                <span>Save to Library</span>
              </button>

              <button
                type="button"
                id="copy-all-package-btn"
                (click)="copyAllContent(pkg)"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">
                  {{ globalCopied() ? 'check' : 'content_copy' }}
                </mat-icon>
                <span>{{ globalCopied() ? 'Copied All!' : 'Copy All Posts' }}</span>
              </button>

              <button
                type="button"
                id="download-package-btn"
                (click)="downloadAsText(pkg)"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">download</mat-icon>
                <span>Export .txt</span>
              </button>
            </div>
          </div>

          <!-- Section 1: Titles & Thumbnail Hooks -->
          <div class="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
            <div class="flex items-center justify-between border-b border-stone-100 pb-3">
              <div class="flex items-center gap-2">
                <mat-icon class="text-amber-500">title</mat-icon>
                <h4 class="font-bold text-stone-900 text-sm sm:text-base">
                  High-Click Title Options (5 Angles)
                </h4>
              </div>
              <span class="text-xs text-stone-500">Click any title to copy</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              @for (titleItem of pkg.titles; track titleItem.title; let idx = $index) {
                <button
                  type="button"
                  [id]="'title-option-' + idx"
                  (click)="copyText(titleItem.title, 'title-' + idx)"
                  class="p-3.5 rounded-xl border border-stone-200 hover:border-stone-900/40 bg-stone-50/50 hover:bg-white transition-all cursor-pointer group space-y-1 text-left w-full"
                >
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="px-2 py-0.5 rounded-md font-semibold bg-stone-200 text-stone-700">
                      {{ titleItem.style }}
                    </span>
                    <span class="text-stone-400 group-hover:text-stone-900 transition-colors">
                      {{ copiedItemKey() === 'title-' + idx ? 'Copied!' : 'Copy' }}
                    </span>
                  </div>
                  <p class="text-sm font-semibold text-stone-900 leading-snug">
                    {{ titleItem.title }}
                  </p>
                </button>
              }

              <!-- Thumbnail Hook badge -->
              @if (pkg.thumbnailHookText) {
                <button
                  type="button"
                  id="thumbnail-hook-box"
                  (click)="copyText(pkg.thumbnailHookText, 'thumb-hook')"
                  class="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-50 transition-all cursor-pointer group space-y-1 text-left w-full"
                >
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="px-2 py-0.5 rounded-md font-bold bg-amber-200 text-amber-900">
                      Cover / Thumbnail Text
                    </span>
                    <span class="text-amber-800">
                      {{ copiedItemKey() === 'thumb-hook' ? 'Copied!' : 'Copy' }}
                    </span>
                  </div>
                  <p class="text-sm font-bold text-amber-950 uppercase tracking-tight">
                    "{{ pkg.thumbnailHookText }}"
                  </p>
                </button>
              }
            </div>
          </div>

          <!-- Section 2: Platform Posts with Interactive Views -->
          <div class="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <!-- Platform Selector Navigation -->
            <div class="flex items-center border-b border-stone-200 bg-stone-50/70 p-2 overflow-x-auto gap-1">
              <button
                type="button"
                id="platform-tab-tiktok"
                (click)="activePlatform.set('tiktok')"
                [class]="activePlatform() === 'tiktok' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer"
              >
                <span class="w-2.5 h-2.5 rounded-full bg-black"></span>
                <span>TikTok</span>
              </button>

              <button
                type="button"
                id="platform-tab-linkedin"
                (click)="activePlatform.set('linkedin')"
                [class]="activePlatform() === 'linkedin' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer"
              >
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>LinkedIn</span>
              </button>

              <button
                type="button"
                id="platform-tab-twitter"
                (click)="activePlatform.set('twitter')"
                [class]="activePlatform() === 'twitter' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer"
              >
                <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                <span>Twitter / X</span>
              </button>

              <button
                type="button"
                id="platform-tab-facebook"
                (click)="activePlatform.set('facebook')"
                [class]="activePlatform() === 'facebook' ? 'bg-white text-blue-800 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer"
              >
                <span class="w-2.5 h-2.5 rounded-full bg-blue-700"></span>
                <span>Facebook</span>
              </button>

              <button
                type="button"
                id="platform-tab-hashtags"
                (click)="activePlatform.set('hashtags')"
                [class]="activePlatform() === 'hashtags' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ml-auto"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px] text-stone-600">tag</mat-icon>
                <span>Hashtag Library</span>
              </button>
            </div>

            <!-- Platform Content Area -->
            <div class="p-5 sm:p-7">
              <!-- TIKTOK TAB -->
              @if (activePlatform() === 'tiktok') {
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <!-- Editor & Details (Col 7) -->
                  <div class="lg:col-span-7 space-y-4">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-stone-900">TikTok Caption & Metadata</span>
                        <span class="text-xs text-stone-500">Formatted for high retention</span>
                      </div>
                      <button
                        type="button"
                        id="copy-tiktok-btn"
                        (click)="copyText(pkg.posts.tiktok.caption, 'tiktok')"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                          {{ copiedItemKey() === 'tiktok' ? 'check' : 'content_copy' }}
                        </mat-icon>
                        <span>{{ copiedItemKey() === 'tiktok' ? 'Copied!' : 'Copy Caption' }}</span>
                      </button>
                    </div>

                    <!-- Audio Suggestion -->
                    @if (pkg.posts.tiktok.suggestedAudio) {
                      <div class="p-3 rounded-xl bg-stone-100 border border-stone-200 text-xs flex items-center gap-2 text-stone-800">
                        <mat-icon class="text-pink-500 !w-4 !h-4 !text-[16px]">music_note</mat-icon>
                        <div>
                          <strong class="font-semibold">Recommended Sound:</strong>
                          <span class="ml-1 text-stone-600">{{ pkg.posts.tiktok.suggestedAudio }}</span>
                        </div>
                      </div>
                    }

                    <!-- On-Screen Hook Overlay -->
                    @if (pkg.posts.tiktok.onScreenHook) {
                      <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                        <div class="font-bold flex items-center gap-1 text-amber-900">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">smart_display</mat-icon>
                          Put this on-screen text in first 3 seconds:
                        </div>
                        <p class="font-semibold text-sm">"{{ pkg.posts.tiktok.onScreenHook }}"</p>
                      </div>
                    }

                    <!-- Caption Textarea -->
                    <div>
                      <label for="tiktok-caption-textarea" class="block text-xs font-semibold text-stone-600 mb-1">
                        Caption & Hashtags (Editable)
                      </label>
                      <textarea
                        id="tiktok-caption-textarea"
                        rows="5"
                        [value]="pkg.posts.tiktok.caption"
                        (input)="onUpdatePost('tiktok', $any($event.target).value)"
                        class="w-full p-3 rounded-xl border border-stone-300 focus:border-stone-900 text-stone-900 text-sm outline-none font-sans leading-relaxed"
                      ></textarea>
                    </div>

                    <!-- Refine with AI Bar -->
                    <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                      <span class="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-amber-500">auto_awesome</mat-icon>
                        Refine TikTok Caption:
                      </span>
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          (click)="refinePost('tiktok', 'Make it more curiosity-driven and witty')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          ⚡ More Witty & Curious
                        </button>
                        <button
                          type="button"
                          (click)="refinePost('tiktok', 'Shorten to under 150 characters')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          ✂️ Make Shorter
                        </button>
                        <button
                          type="button"
                          (click)="refinePost('tiktok', 'Add a stronger call to action in the comments')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          💬 Stronger Comment CTA
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Simulated TikTok Mobile Mockup (Col 5) -->
                  <div class="lg:col-span-5 flex justify-center">
                    <div class="w-full max-w-[280px] aspect-[9/16] bg-stone-900 rounded-[28px] p-3 text-white flex flex-col justify-between shadow-lg relative overflow-hidden border-4 border-stone-800">
                      <!-- Status / Header -->
                      <div class="flex items-center justify-between text-[11px] text-white/80 pt-1">
                        <span class="font-bold">LIVE</span>
                        <span class="font-semibold text-white">For You</span>
                        <mat-icon class="!w-4 !h-4 !text-[16px]">search</mat-icon>
                      </div>

                      <!-- Center: On-Screen Text Mockup -->
                      <div class="my-auto text-center px-3 py-4 rounded-xl bg-black/40 backdrop-blur-xs border border-white/10">
                        <p class="text-xs font-black uppercase text-amber-300 drop-shadow-md leading-tight">
                          {{ pkg.posts.tiktok.onScreenHook || pkg.thumbnailHookText || pkg.videoTitle }}
                        </p>
                      </div>

                      <!-- Bottom TikTok Overlay -->
                      <div class="space-y-2 pb-1">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center font-bold text-[10px] text-white">
                            YOU
                          </div>
                          <span class="font-bold text-xs">@yourcontent</span>
                        </div>
                        <p class="text-[11px] text-white/90 line-clamp-3 leading-snug">
                          {{ pkg.posts.tiktok.caption }}
                        </p>
                        <div class="flex items-center gap-1 text-[10px] text-white/70">
                          <mat-icon class="!w-3 !h-3 !text-[12px] animate-spin">music_note</mat-icon>
                          <span class="truncate">{{ pkg.posts.tiktok.suggestedAudio || 'Original Audio - @yourcontent' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- LINKEDIN TAB -->
              @if (activePlatform() === 'linkedin') {
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <!-- Editor (Col 7) -->
                  <div class="lg:col-span-7 space-y-4">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-sm font-bold text-stone-900">LinkedIn Post</span>
                        <span class="text-xs text-stone-500 block">
                          Characters: {{ pkg.posts.linkedin.fullPost.length }} (Optimal: 600–1,300)
                        </span>
                      </div>
                      <button
                        type="button"
                        id="copy-linkedin-btn"
                        (click)="copyText(pkg.posts.linkedin.fullPost, 'linkedin')"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                          {{ copiedItemKey() === 'linkedin' ? 'check' : 'content_copy' }}
                        </mat-icon>
                        <span>{{ copiedItemKey() === 'linkedin' ? 'Copied!' : 'Copy LinkedIn Post' }}</span>
                      </button>
                    </div>

                    @if (pkg.posts.linkedin.bestPracticeTip) {
                      <div class="p-2.5 rounded-lg bg-blue-50 text-blue-900 text-xs flex items-center gap-2">
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-blue-700 shrink-0">info</mat-icon>
                        <span>{{ pkg.posts.linkedin.bestPracticeTip }}</span>
                      </div>
                    }

                    <!-- First line hook indicator -->
                    <div class="p-2.5 rounded-lg bg-stone-100 text-xs text-stone-700">
                      <strong class="text-stone-900">Above-the-fold hook:</strong>
                      <span class="italic block mt-0.5">"{{ pkg.posts.linkedin.hook }}"</span>
                    </div>

                    <!-- Editable LinkedIn Post -->
                    <div>
                      <textarea
                        id="linkedin-post-textarea"
                        rows="10"
                        [value]="pkg.posts.linkedin.fullPost"
                        (input)="onUpdatePost('linkedin', $any($event.target).value)"
                        class="w-full p-3 rounded-xl border border-stone-300 focus:border-stone-900 text-stone-900 text-sm outline-none font-sans leading-relaxed whitespace-pre-wrap"
                      ></textarea>
                    </div>

                    <!-- Refine Bar -->
                    <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                      <span class="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-blue-600">auto_awesome</mat-icon>
                        Refine LinkedIn Post:
                      </span>
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          (click)="refinePost('linkedin', 'Make it sound more executive and leadership focused')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          👔 Executive Tone
                        </button>
                        <button
                          type="button"
                          (click)="refinePost('linkedin', 'Format with clear clean bullet points and actionable takeaways')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          📋 Add Bullet Points
                        </button>
                        <button
                          type="button"
                          (click)="refinePost('linkedin', 'Add an engaging discussion question at the end for comments')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          💬 Drive Comments
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Simulated LinkedIn Post Feed Mockup (Col 5) -->
                  <div class="lg:col-span-5">
                    <div class="bg-white rounded-xl border border-stone-200 p-4 shadow-sm space-y-3">
                      <!-- User Header -->
                      <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          PRO
                        </div>
                        <div class="min-w-0">
                          <p class="text-xs font-bold text-stone-900 leading-none">Your Name</p>
                          <p class="text-[10px] text-stone-500 truncate">Video Creator & Thought Leader</p>
                          <p class="text-[10px] text-stone-400">Just now • 🌐</p>
                        </div>
                      </div>

                      <!-- Post Body Preview -->
                      <div class="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed max-h-[320px] overflow-y-auto pr-1">
                        {{ pkg.posts.linkedin.fullPost }}
                      </div>

                      <!-- Video Mockup Attachment -->
                      <div class="rounded-lg bg-stone-900 aspect-video flex flex-col items-center justify-center text-white p-3 text-center">
                        <mat-icon class="!w-8 !h-8 !text-[32px] text-amber-400 mb-1">play_circle_filled</mat-icon>
                        <p class="text-xs font-bold">{{ pkg.videoTitle }}</p>
                      </div>

                      <!-- LinkedIn Action Buttons Mockup -->
                      <div class="pt-2 border-t border-stone-100 flex items-center justify-between text-stone-500 text-[11px]">
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">thumb_up</mat-icon> Like</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">comment</mat-icon> Comment</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">repeat</mat-icon> Repost</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">send</mat-icon> Send</span>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- TWITTER / X TAB -->
              @if (activePlatform() === 'twitter') {
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <!-- Editor (Col 7) -->
                  <div class="lg:col-span-7 space-y-4">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-sm font-bold text-stone-900">Twitter / X Post</span>
                        <span class="text-xs block" [class]="pkg.posts.twitter.mainTweet.length > 280 ? 'text-rose-600 font-bold' : 'text-stone-500'">
                          {{ pkg.posts.twitter.mainTweet.length }} / 280 characters
                        </span>
                      </div>
                      <button
                        type="button"
                        id="copy-twitter-btn"
                        (click)="copyText(pkg.posts.twitter.mainTweet, 'twitter')"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                          {{ copiedItemKey() === 'twitter' ? 'check' : 'content_copy' }}
                        </mat-icon>
                        <span>{{ copiedItemKey() === 'twitter' ? 'Copied!' : 'Copy Tweet' }}</span>
                      </button>
                    </div>

                    <!-- Character Meter -->
                    <div class="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        class="h-full transition-all"
                        [class]="pkg.posts.twitter.mainTweet.length > 280 ? 'bg-rose-500' : 'bg-sky-500'"
                        [style.width.%]="Math.min(100, (pkg.posts.twitter.mainTweet.length / 280) * 100)"
                      ></div>
                    </div>

                    <div>
                      <label for="twitter-tweet-textarea" class="block text-xs font-semibold text-stone-600 mb-1">
                        Main Tweet (Strictly under 280 characters)
                      </label>
                      <textarea
                        id="twitter-tweet-textarea"
                        rows="4"
                        [value]="pkg.posts.twitter.mainTweet"
                        (input)="onUpdatePost('twitter', $any($event.target).value)"
                        class="w-full p-3 rounded-xl border border-stone-300 focus:border-stone-900 text-stone-900 text-sm outline-none font-sans leading-relaxed"
                      ></textarea>
                    </div>

                    <!-- Thread Suggestions -->
                    @if (pkg.posts.twitter.threadSuggestion && pkg.posts.twitter.threadSuggestion.length > 0) {
                      <div class="space-y-2 pt-2 border-t border-stone-100">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold text-stone-800 flex items-center gap-1">
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-sky-500">format_list_numbered</mat-icon>
                            Optional 3-Part Thread Extension
                          </span>
                          <button
                            type="button"
                            (click)="copyThread(pkg.posts.twitter.threadSuggestion)"
                            class="text-xs text-stone-600 hover:text-stone-900 underline cursor-pointer"
                          >
                            Copy Thread
                          </button>
                        </div>
                        <div class="space-y-2">
                          @for (tweet of pkg.posts.twitter.threadSuggestion; track tweet; let i = $index) {
                            <div class="p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-800 space-y-1">
                              <span class="font-bold text-stone-500 text-[10px]">Tweet #{{ i + 1 }}</span>
                              <p>{{ tweet }}</p>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Refine Bar -->
                    <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                      <span class="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-sky-500">auto_awesome</mat-icon>
                        Refine Tweet:
                      </span>
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          (click)="refinePost('twitter', 'Ensure tweet is strictly under 250 characters with high curiosity')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          ⚡ Make Punchier (&lt;250 chars)
                        </button>
                        <button
                          type="button"
                          (click)="refinePost('twitter', 'Ask an open question to provoke replies and quote tweets')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          💬 Provoke Discussion
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Simulated Tweet Card Mockup (Col 5) -->
                  <div class="lg:col-span-5">
                    <div class="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-3">
                      <div class="flex items-center gap-2">
                        <div class="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs">
                          X
                        </div>
                        <div>
                          <div class="flex items-center gap-1">
                            <span class="font-bold text-xs text-stone-900">Creator</span>
                            <span class="text-stone-400 text-[11px]">@creator • 1m</span>
                          </div>
                        </div>
                      </div>

                      <p class="text-xs text-stone-900 leading-relaxed whitespace-pre-wrap">
                        {{ pkg.posts.twitter.mainTweet }}
                      </p>

                      <!-- Video Card Attachment -->
                      <div class="rounded-xl overflow-hidden border border-stone-200 bg-stone-900 aspect-video flex flex-col items-center justify-center text-white relative">
                        <mat-icon class="!w-8 !h-8 !text-[32px] text-white">play_arrow</mat-icon>
                        <span class="text-[10px] text-white/80 absolute bottom-2 left-2 bg-black/60 px-1.5 py-0.5 rounded">0:58</span>
                      </div>

                      <div class="pt-2 border-t border-stone-100 flex items-center justify-between text-stone-400 text-xs">
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">chat_bubble_outline</mat-icon> 24</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">repeat</mat-icon> 18</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">favorite_border</mat-icon> 142</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">share</mat-icon></span>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- FACEBOOK TAB -->
              @if (activePlatform() === 'facebook') {
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <!-- Editor (Col 7) -->
                  <div class="lg:col-span-7 space-y-4">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-sm font-bold text-stone-900">Facebook Post</span>
                        <span class="text-xs text-stone-500 block">
                          Conversational & Community Storytelling
                        </span>
                      </div>
                      <button
                        type="button"
                        id="copy-facebook-btn"
                        (click)="copyText(pkg.posts.facebook.fullPost, 'facebook')"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                          {{ copiedItemKey() === 'facebook' ? 'check' : 'content_copy' }}
                        </mat-icon>
                        <span>{{ copiedItemKey() === 'facebook' ? 'Copied!' : 'Copy Facebook Post' }}</span>
                      </button>
                    </div>

                    @if (pkg.posts.facebook.bestPracticeTip) {
                      <div class="p-2.5 rounded-lg bg-blue-50 text-blue-900 text-xs flex items-center gap-2">
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-blue-600 shrink-0">info</mat-icon>
                        <span>{{ pkg.posts.facebook.bestPracticeTip }}</span>
                      </div>
                    }

                    <div>
                      <textarea
                        id="facebook-post-textarea"
                        rows="8"
                        [value]="pkg.posts.facebook.fullPost"
                        (input)="onUpdatePost('facebook', $any($event.target).value)"
                        class="w-full p-3 rounded-xl border border-stone-300 focus:border-stone-900 text-stone-900 text-sm outline-none font-sans leading-relaxed whitespace-pre-wrap"
                      ></textarea>
                    </div>

                    <!-- Refine Bar -->
                    <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                      <span class="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-blue-600">auto_awesome</mat-icon>
                        Refine Facebook Post:
                      </span>
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          (click)="refinePost('facebook', 'Make it more personal, vulnerable and relatable')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          ❤️ Warm Storytelling
                        </button>
                        <button
                          type="button"
                          (click)="refinePost('facebook', 'Add a clear prompt for followers to share their own experience')"
                          class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 cursor-pointer"
                        >
                          👥 Community Question
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Simulated Facebook Feed Mockup (Col 5) -->
                  <div class="lg:col-span-5">
                    <div class="bg-white rounded-xl border border-stone-200 p-4 shadow-sm space-y-3">
                      <div class="flex items-center gap-2">
                        <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                          f
                        </div>
                        <div>
                          <p class="text-xs font-bold text-stone-900">Your Page</p>
                          <p class="text-[10px] text-stone-400">Sponsored / Recommended • 🌐</p>
                        </div>
                      </div>

                      <p class="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                        {{ pkg.posts.facebook.fullPost }}
                      </p>

                      <div class="rounded-lg bg-stone-900 aspect-video flex items-center justify-center text-white">
                        <mat-icon class="!w-8 !h-8 !text-[32px] text-amber-400">play_circle_outline</mat-icon>
                      </div>

                      <div class="pt-2 border-t border-stone-100 flex items-center justify-between text-stone-500 text-xs">
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">thumb_up</mat-icon> Like</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">chat_bubble_outline</mat-icon> Comment</span>
                        <span class="flex items-center gap-1"><mat-icon class="!w-3.5 !h-3.5 !text-[14px]">share</mat-icon> Share</span>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- HASHTAGS & UNIVERSAL CAPTIONS TAB -->
              @if (activePlatform() === 'hashtags') {
                <div class="space-y-6">
                  <!-- Universal Captions -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold uppercase tracking-wider text-stone-700">Universal Short Caption</span>
                        <button
                          type="button"
                          (click)="copyText(pkg.captions.short, 'caption-short')"
                          class="text-xs text-stone-600 hover:text-stone-900 font-semibold cursor-pointer"
                        >
                          {{ copiedItemKey() === 'caption-short' ? 'Copied!' : 'Copy' }}
                        </button>
                      </div>
                      <p class="text-xs text-stone-800 leading-relaxed">{{ pkg.captions.short }}</p>
                    </div>

                    <div class="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold uppercase tracking-wider text-stone-700">Universal Detailed Caption</span>
                        <button
                          type="button"
                          (click)="copyText(pkg.captions.long, 'caption-long')"
                          class="text-xs text-stone-600 hover:text-stone-900 font-semibold cursor-pointer"
                        >
                          {{ copiedItemKey() === 'caption-long' ? 'Copied!' : 'Copy' }}
                        </button>
                      </div>
                      <p class="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">{{ pkg.captions.long }}</p>
                    </div>
                  </div>

                  <!-- Hashtag Clusters -->
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <h5 class="font-bold text-stone-900 text-sm">Hashtag Collections</h5>
                      <button
                        type="button"
                        id="copy-all-hashtags-btn"
                        (click)="copyAllHashtags(pkg)"
                        class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        {{ copiedItemKey() === 'all-hashtags' ? 'Copied All!' : 'Copy All Combined Hashtags' }}
                      </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <!-- Broad -->
                      <div class="p-4 rounded-xl border border-stone-200 bg-white space-y-2">
                        <span class="text-xs font-bold text-stone-600 block">Broad Category Tags</span>
                        <div class="flex flex-wrap gap-1.5">
                          @for (tag of pkg.hashtags.broad; track tag) {
                            <button
                              type="button"
                              (click)="copyText(tag, tag)"
                              class="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs transition-colors cursor-pointer"
                            >
                              {{ tag }}
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Niche -->
                      <div class="p-4 rounded-xl border border-stone-200 bg-white space-y-2">
                        <span class="text-xs font-bold text-stone-600 block">Niche / Target Audience Tags</span>
                        <div class="flex flex-wrap gap-1.5">
                          @for (tag of pkg.hashtags.niche; track tag) {
                            <button
                              type="button"
                              (click)="copyText(tag, tag)"
                              class="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs transition-colors cursor-pointer"
                            >
                              {{ tag }}
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Trending -->
                      <div class="p-4 rounded-xl border border-stone-200 bg-white space-y-2">
                        <span class="text-xs font-bold text-stone-600 block">Trending / Community Tags</span>
                        <div class="flex flex-wrap gap-1.5">
                          @for (tag of pkg.hashtags.trending; track tag) {
                            <button
                              type="button"
                              (click)="copyText(tag, tag)"
                              class="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs transition-colors cursor-pointer"
                            >
                              {{ tag }}
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Strategic Pinned Comment -->
                  @if (pkg.pinnedComment) {
                    <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start justify-between gap-3">
                      <div>
                        <strong class="block font-bold text-amber-900 mb-1">
                          📌 Strategic Pinned First Comment:
                        </strong>
                        <p class="leading-relaxed">"{{ pkg.pinnedComment }}"</p>
                      </div>
                      <button
                        type="button"
                        (click)="copyText(pkg.pinnedComment, 'pinned-comment')"
                        class="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold text-xs shrink-0 cursor-pointer"
                      >
                        {{ copiedItemKey() === 'pinned-comment' ? 'Copied!' : 'Copy' }}
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class SocialDistributor {
  readonly service = inject(ContentCreator);
  readonly Math = Math;

  readonly activePlatform = signal<ActivePlatformTab>('tiktok');
  readonly copiedItemKey = signal<string | null>(null);
  readonly globalCopied = signal<boolean>(false);

  readonly form = new FormGroup({
    videoTitle: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    videoDescription: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)],
    }),
    tone: new FormControl<string>('Engaging, authoritative & conversational', {nonNullable: true}),
  });

  constructor() {
    // When an idea is selected from ideation step, auto-populate the form
    effect(() => {
      const selected = this.service.selectedIdea();
      if (selected) {
        this.form.patchValue({
          videoTitle: selected.title,
          videoDescription: `${selected.conceptSummary}\n\nHook: ${selected.hook}\n\nKey takeaways: ${selected.keyTakeaways.join(', ')}`,
        });
      }
    });
  }

  clearSelectedIdea(): void {
    this.service.selectedIdea.set(null);
    this.form.reset({
      videoTitle: '',
      videoDescription: '',
      tone: 'Engaging, authoritative & conversational',
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    const idea = this.service.selectedIdea();

    this.service.generateSocialPackage({
      videoTitle: values.videoTitle,
      videoDescription: values.videoDescription,
      keyPoints: idea?.keyTakeaways || [],
      tone: values.tone,
      sourceIdeaId: idea?.id,
    });
  }

  onUpdatePost(platform: 'linkedin' | 'facebook' | 'tiktok' | 'twitter', text: string): void {
    this.service.updatePostText(platform, text);
  }

  async refinePost(platform: 'linkedin' | 'facebook' | 'tiktok' | 'twitter', instruction: string): Promise<void> {
    const pkg = this.service.currentPackage();
    if (!pkg) return;

    let current = '';
    if (platform === 'tiktok') current = pkg.posts.tiktok.caption;
    else if (platform === 'linkedin') current = pkg.posts.linkedin.fullPost;
    else if (platform === 'twitter') current = pkg.posts.twitter.mainTweet;
    else if (platform === 'facebook') current = pkg.posts.facebook.fullPost;

    try {
      const refined = await this.service.refineText(platform, current, instruction);
      this.service.updatePostText(platform, refined);
    } catch (e) {
      console.error(e);
    }
  }

  savePackage(): void {
    this.service.saveCurrentPackage();
    this.copiedItemKey.set('pkg-saved');
    setTimeout(() => this.copiedItemKey.set(null), 2000);
  }

  async copyText(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedItemKey.set(key);
      setTimeout(() => this.copiedItemKey.set(null), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  async copyThread(thread: string[]): Promise<void> {
    const text = thread.map((t, idx) => `[Tweet ${idx + 1}]\n${t}`).join('\n\n');
    await this.copyText(text, 'twitter-thread');
  }

  async copyAllHashtags(pkg: SocialPackage): Promise<void> {
    const allTags = [
      ...pkg.hashtags.broad,
      ...pkg.hashtags.niche,
      ...pkg.hashtags.trending,
    ].join(' ');
    await this.copyText(allTags, 'all-hashtags');
  }

  async copyAllContent(pkg: SocialPackage): Promise<void> {
    const content = `================================================
VIDEO SOCIAL MEDIA DISTRIBUTION PACKAGE
Title: ${pkg.videoTitle}
================================================

--- TITLE OPTIONS ---
${pkg.titles.map((t) => `• [${t.style}] ${t.title}`).join('\n')}
Cover Text: "${pkg.thumbnailHookText}"

--- TIKTOK ---
On-Screen Hook: "${pkg.posts.tiktok.onScreenHook}"
Sound Vibe: ${pkg.posts.tiktok.suggestedAudio}
Caption:
${pkg.posts.tiktok.caption}

--- LINKEDIN ---
Hook: "${pkg.posts.linkedin.hook}"
Post:
${pkg.posts.linkedin.fullPost}

--- TWITTER / X ---
Tweet:
${pkg.posts.twitter.mainTweet}

--- FACEBOOK ---
Post:
${pkg.posts.facebook.fullPost}

--- HASHTAGS ---
Broad: ${pkg.hashtags.broad.join(' ')}
Niche: ${pkg.hashtags.niche.join(' ')}
Trending: ${pkg.hashtags.trending.join(' ')}

--- PINNED COMMENT ---
${pkg.pinnedComment}
`;
    await this.copyText(content, 'all-content');
    this.globalCopied.set(true);
    setTimeout(() => this.globalCopied.set(false), 2000);
  }

  downloadAsText(pkg: SocialPackage): void {
    const content = `VIDEO SOCIAL DISTRIBUTION PACKAGE
Video: ${pkg.videoTitle}
Created: ${new Date(pkg.createdAt).toLocaleDateString()}

TITLES:
${pkg.titles.map((t) => `- [${t.style}] ${t.title}`).join('\n')}

TIKTOK CAPTION:
${pkg.posts.tiktok.caption}

LINKEDIN POST:
${pkg.posts.linkedin.fullPost}

TWITTER / X TWEET:
${pkg.posts.twitter.mainTweet}

FACEBOOK POST:
${pkg.posts.facebook.fullPost}

HASHTAGS:
${pkg.hashtags.broad.concat(pkg.hashtags.niche, pkg.hashtags.trending).join(' ')}

PINNED COMMENT:
${pkg.pinnedComment}
`;

    const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.videoTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-social-package.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
