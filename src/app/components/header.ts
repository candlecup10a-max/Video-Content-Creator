import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ContentCreator} from '../services/content-creator';
import {MainNavTab} from '../models/content.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-header',
  imports: [MatIconModule],
  template: `
    <header class="bg-white/95 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40 shadow-xs">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <!-- Main Top Bar Row -->
        <div class="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          <!-- Logo & Brand Identity -->
          <div class="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white border border-stone-200/90 p-1 shadow-2xs overflow-hidden shrink-0 flex items-center justify-center transition-all hover:scale-105">
              <img
                src="/logo.png"
                alt="Video Content Creator Logo"
                class="w-full h-full object-contain"
                referrerpolicy="no-referrer"
              />
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="text-base sm:text-lg font-black text-stone-900 truncate tracking-tight">
                  Video Content Creator
                </h1>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200/80 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>AI Studio</span>
                </span>
              </div>
              <p class="text-[11px] sm:text-xs text-stone-500 truncate mt-0.5">
                <span class="font-semibold text-stone-700">Capture | Create | Inspire</span>
                <span class="hidden md:inline text-stone-400"> • </span>
                <span class="hidden md:inline">Ideas, schedules & video captions</span>
              </p>
            </div>
          </div>

          <!-- Desktop & Tablet Navigation Menu (Hidden on small mobile, shown on sm and up) -->
          <nav class="hidden sm:flex items-center gap-1 bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200/80 shrink-0 shadow-2xs">
            <!-- Step 1: Ideas -->
            <button
              id="nav-tab-ideation"
              type="button"
              (click)="selectTab('ideation')"
              [class]="service.activeTab() === 'ideation' 
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/90' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all cursor-pointer whitespace-nowrap"
              title="Step 1: Ideate viral video concepts"
            >
              <span 
                class="w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center transition-colors"
                [class]="service.activeTab() === 'ideation' ? 'bg-amber-100 text-amber-900' : 'bg-stone-200 text-stone-600'"
              >1</span>
              <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-500">lightbulb</mat-icon>
              <span class="hidden lg:inline">Ideas</span>
              <span class="inline lg:hidden">Ideas</span>
            </button>

            <!-- Step 2: Schedule -->
            <button
              id="nav-tab-schedule"
              type="button"
              (click)="selectTab('schedule')"
              [class]="service.activeTab() === 'schedule' 
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/90' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all cursor-pointer whitespace-nowrap relative"
              title="Step 2: Plan video shooting schedules and scenes"
            >
              <span 
                class="w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center transition-colors"
                [class]="service.activeTab() === 'schedule' ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-200 text-stone-600'"
              >2</span>
              <mat-icon class="!w-4 !h-4 !text-[16px] text-emerald-600">calendar_month</mat-icon>
              <span class="hidden lg:inline">Shoot Schedule</span>
              <span class="inline lg:hidden">Schedule</span>
              @if (service.schedules().length > 0) {
                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {{ service.schedules().length }}
                </span>
              }
            </button>

            <!-- Step 3: Video & Captions -->
            <button
              id="nav-tab-captions"
              type="button"
              (click)="selectTab('captions')"
              [class]="service.activeTab() === 'captions' 
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/90' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all cursor-pointer whitespace-nowrap relative"
              title="Step 3: Separate speech captions or analyze silent B-roll"
            >
              <span 
                class="w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center transition-colors"
                [class]="service.activeTab() === 'captions' ? 'bg-indigo-100 text-indigo-900' : 'bg-stone-200 text-stone-600'"
              >3</span>
              <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600">subtitles</mat-icon>
              <span class="hidden lg:inline">Video & Captions</span>
              <span class="inline lg:hidden">Captions</span>
              @if (service.activeCaptionProject()) {
                <span class="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              }
            </button>

            <!-- Step 4: Social Posts -->
            <button
              id="nav-tab-package"
              type="button"
              (click)="selectTab('package')"
              [class]="service.activeTab() === 'package' 
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/90' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all cursor-pointer whitespace-nowrap relative"
              title="Step 4: Multi-platform distribution posts"
            >
              <span 
                class="w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center transition-colors"
                [class]="service.activeTab() === 'package' ? 'bg-purple-100 text-purple-900' : 'bg-stone-200 text-stone-600'"
              >4</span>
              <mat-icon class="!w-4 !h-4 !text-[16px] text-purple-600">share</mat-icon>
              <span class="hidden lg:inline">Social Posts</span>
              <span class="inline lg:hidden">Socials</span>
              @if (service.currentPackage()) {
                <span class="w-2 h-2 rounded-full bg-purple-600"></span>
              }
            </button>

            <!-- Divider -->
            <div class="w-px h-5 bg-stone-200/80 mx-1"></div>

            <!-- Saved Library Tab -->
            <button
              id="nav-tab-saved"
              type="button"
              (click)="selectTab('saved')"
              [class]="service.activeTab() === 'saved' 
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/90' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all cursor-pointer whitespace-nowrap"
              title="Saved ideas & packages library"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px] text-rose-500">bookmark</mat-icon>
              <span>Saved</span>
              @if (totalSaved() > 0) {
                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700">
                  {{ totalSaved() }}
                </span>
              }
            </button>
          </nav>

          <!-- Mobile Quick Saved Button (Visible on mobile only) -->
          <div class="sm:hidden flex items-center gap-1">
            <button
              type="button"
              (click)="selectTab('saved')"
              [class]="service.activeTab() === 'saved'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]" [class]="service.activeTab() === 'saved' ? 'text-rose-400' : 'text-rose-500'">bookmark</mat-icon>
              <span>Saved</span>
              @if (totalSaved() > 0) {
                <span class="px-1 rounded-full text-[10px] font-bold bg-white/20">
                  {{ totalSaved() }}
                </span>
              }
            </button>
          </div>
        </div>

        <!-- Mobile Workflow Sub-Bar (Visible on mobile only) -->
        <div class="sm:hidden pb-2.5 pt-0.5">
          <nav class="grid grid-cols-4 gap-1 bg-stone-100/95 p-1 rounded-xl border border-stone-200/80">
            <!-- Step 1: Ideas -->
            <button
              type="button"
              (click)="selectTab('ideation')"
              [class]="service.activeTab() === 'ideation'
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'"
              class="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] transition-all cursor-pointer"
            >
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-black px-1 rounded bg-amber-100 text-amber-800">1</span>
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-amber-500">lightbulb</mat-icon>
              </div>
              <span class="mt-0.5 font-medium">Ideas</span>
            </button>

            <!-- Step 2: Schedule -->
            <button
              type="button"
              (click)="selectTab('schedule')"
              [class]="service.activeTab() === 'schedule'
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'"
              class="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] transition-all cursor-pointer relative"
            >
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-black px-1 rounded bg-emerald-100 text-emerald-800">2</span>
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-emerald-600">calendar_month</mat-icon>
              </div>
              <span class="mt-0.5 font-medium">Schedule</span>
            </button>

            <!-- Step 3: Captions -->
            <button
              type="button"
              (click)="selectTab('captions')"
              [class]="service.activeTab() === 'captions'
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'"
              class="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] transition-all cursor-pointer relative"
            >
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-black px-1 rounded bg-indigo-100 text-indigo-800">3</span>
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-indigo-600">subtitles</mat-icon>
              </div>
              <span class="mt-0.5 font-medium">Captions</span>
            </button>

            <!-- Step 4: Socials -->
            <button
              type="button"
              (click)="selectTab('package')"
              [class]="service.activeTab() === 'package'
                ? 'bg-white text-stone-900 font-bold shadow-xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'"
              class="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] transition-all cursor-pointer relative"
            >
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-black px-1 rounded bg-purple-100 text-purple-800">4</span>
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-purple-600">share</mat-icon>
              </div>
              <span class="mt-0.5 font-medium">Socials</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  `,
})
export class Header {
  readonly service = inject(ContentCreator);

  readonly totalSaved = computed(() => {
    return this.service.savedIdeas().length + this.service.savedPackages().length;
  });

  selectTab(tab: MainNavTab): void {
    this.service.setTab(tab);
  }
}
