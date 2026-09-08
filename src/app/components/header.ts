import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ContentCreator} from '../services/content-creator';
import {MainNavTab} from '../models/content.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-header',
  imports: [MatIconModule],
  template: `
    <header class="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 sm:h-20 gap-4">
          <!-- Logo & Brand -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-sm">
              <mat-icon class="text-amber-400">videocam</mat-icon>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="text-base sm:text-lg font-bold text-stone-900 truncate tracking-tight">
                  Video Content Creator
                </h1>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 shrink-0">
                  AI Studio
                </span>
              </div>
              <p class="text-xs text-stone-500 hidden sm:block truncate">
                Ideate video concepts & prepare posts for TikTok, LinkedIn, Twitter & Facebook
              </p>
            </div>
          </div>

          <!-- Navigation Pills -->
          <nav class="flex items-center gap-1 bg-stone-100/90 p-1 rounded-xl shrink-0 overflow-x-auto max-w-full">
            <button
              id="nav-tab-ideation"
              type="button"
              (click)="selectTab('ideation')"
              [class]="service.activeTab() === 'ideation' 
                ? 'bg-white text-stone-900 font-semibold shadow-xs' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-600">lightbulb</mat-icon>
              <span>1. Ideas</span>
            </button>

            <button
              id="nav-tab-schedule"
              type="button"
              (click)="selectTab('schedule')"
              [class]="service.activeTab() === 'schedule' 
                ? 'bg-white text-stone-900 font-semibold shadow-xs' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap relative"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px] text-emerald-600">calendar_month</mat-icon>
              <span>2. Shoot Schedule</span>
              @if (service.schedules().length > 0) {
                <span class="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                  {{ service.schedules().length }}
                </span>
              }
            </button>

            <button
              id="nav-tab-captions"
              type="button"
              (click)="selectTab('captions')"
              [class]="service.activeTab() === 'captions' 
                ? 'bg-white text-stone-900 font-semibold shadow-xs' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap relative"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600">subtitles</mat-icon>
              <span>3. Video & Captions</span>
              @if (service.activeCaptionProject()) {
                <span class="w-2 h-2 rounded-full bg-indigo-600 absolute -top-0.5 -right-0.5"></span>
              }
            </button>

            <button
              id="nav-tab-package"
              type="button"
              (click)="selectTab('package')"
              [class]="service.activeTab() === 'package' 
                ? 'bg-white text-stone-900 font-semibold shadow-xs' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap relative"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px] text-purple-600">share</mat-icon>
              <span>4. Social Posts</span>
              @if (service.currentPackage()) {
                <span class="w-2 h-2 rounded-full bg-purple-600 absolute -top-0.5 -right-0.5"></span>
              }
            </button>

            <button
              id="nav-tab-saved"
              type="button"
              (click)="selectTab('saved')"
              [class]="service.activeTab() === 'saved' 
                ? 'bg-white text-stone-900 font-semibold shadow-xs' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'"
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px] text-rose-500">bookmark</mat-icon>
              <span>Saved</span>
              @let totalSaved = service.savedIdeas().length + service.savedPackages().length;
              @if (totalSaved > 0) {
                <span class="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-stone-200 text-stone-700 font-medium">
                  {{ totalSaved }}
                </span>
              }
            </button>
          </nav>
        </div>
      </div>
    </header>
  `,
})
export class Header {
  readonly service = inject(ContentCreator);

  selectTab(tab: MainNavTab): void {
    this.service.setTab(tab);
  }
}
