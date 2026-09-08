import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ReactiveFormsModule, FormControl, FormGroup, Validators} from '@angular/forms';
import {ContentCreator} from '../services/content-creator';
import {ShootStatus, VideoShootSchedule} from '../models/content.models';

type ScheduleFilter = 'all' | 'today' | 'upcoming' | 'recorded' | 'completed';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shoot-schedule',
  imports: [MatIconModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- Section Header -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800">
              <mat-icon class="!w-5 !h-5 !text-[20px]">calendar_today</mat-icon>
            </span>
            <h2 class="text-2xl font-bold text-stone-900 tracking-tight">Video Taking Schedule</h2>
          </div>
          <p class="text-sm text-stone-600 mt-1">
            Plan your filming sessions, structure scene shot lists, verify equipment checklists, and track takes.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            id="open-schedule-modal-btn"
            type="button"
            (click)="onOpenCreateModal()"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px] text-emerald-400">add</mat-icon>
            <span>+ Schedule New Video Shoot</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Ribbon -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <div class="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Total Shoots</span>
            <mat-icon class="!w-4 !h-4 !text-[16px] text-stone-400">video_library</mat-icon>
          </div>
          <div class="text-2xl font-bold text-stone-900 mt-1.5">
            {{ service.schedules().length }}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-white border border-emerald-200/80 shadow-2xs">
          <div class="flex items-center justify-between text-xs text-emerald-700 font-medium">
            <span>Filming Today</span>
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div class="text-2xl font-bold text-emerald-900 mt-1.5">
            {{ todayCount() }}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <div class="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Upcoming</span>
            <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-500">schedule</mat-icon>
          </div>
          <div class="text-2xl font-bold text-stone-900 mt-1.5">
            {{ upcomingCount() }}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <div class="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Recorded / Ready</span>
            <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-500">task_alt</mat-icon>
          </div>
          <div class="text-2xl font-bold text-stone-900 mt-1.5">
            {{ recordedCount() }}
          </div>
        </div>
      </div>

      <!-- Filter Tabs & Search -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl overflow-x-auto">
          <button
            type="button"
            (click)="activeFilter.set('all')"
            [class]="activeFilter() === 'all' ? 'bg-white text-stone-900 font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900'"
            class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap"
          >
            All ({{ service.schedules().length }})
          </button>
          <button
            type="button"
            (click)="activeFilter.set('today')"
            [class]="activeFilter() === 'today' ? 'bg-white text-emerald-800 font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900'"
            class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Today ({{ todayCount() }})</span>
          </button>
          <button
            type="button"
            (click)="activeFilter.set('upcoming')"
            [class]="activeFilter() === 'upcoming' ? 'bg-white text-stone-900 font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900'"
            class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap"
          >
            Upcoming ({{ upcomingCount() }})
          </button>
          <button
            type="button"
            (click)="activeFilter.set('recorded')"
            [class]="activeFilter() === 'recorded' ? 'bg-white text-indigo-700 font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900'"
            class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap"
          >
            Recorded ({{ recordedCount() }})
          </button>
          <button
            type="button"
            (click)="activeFilter.set('completed')"
            [class]="activeFilter() === 'completed' ? 'bg-white text-stone-900 font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900'"
            class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap"
          >
            Completed
          </button>
        </div>

        <div class="relative min-w-[200px]">
          <input
            type="text"
            [value]="searchQuery()"
            (input)="onSearchChange($event)"
            placeholder="Search shoots by title..."
            class="w-full px-3 py-1.5 pl-8 rounded-lg bg-white border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
          />
          <mat-icon class="!w-4 !h-4 !text-[16px] text-stone-400 absolute left-2.5 top-2">search</mat-icon>
        </div>
      </div>

      <!-- Main Two-Column Scheduling Workspace -->
      @if (filteredSchedules().length === 0) {
        <div class="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-stone-300 space-y-4">
          <div class="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <mat-icon class="!w-6 !h-6 !text-[24px]">videocam_off</mat-icon>
          </div>
          <div>
            <h3 class="text-base font-bold text-stone-900">No scheduled shoots found</h3>
            <p class="text-xs text-stone-500 max-w-md mx-auto mt-1">
              Start planning your next recording session or brainstorm ideas in Tab 1 and click "Schedule Shoot".
            </p>
          </div>
          <button
            type="button"
            (click)="onOpenCreateModal()"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">add</mat-icon>
            <span>Schedule First Video</span>
          </button>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left Column: Shoot Cards List (5 cols on lg) -->
          <div class="lg:col-span-5 space-y-3">
            @for (shoot of filteredSchedules(); track shoot.id) {
              <button
                type="button"
                [id]="'shoot-card-' + shoot.id"
                (click)="service.selectSchedule(shoot)"
                [class]="service.selectedSchedule()?.id === shoot.id 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs' 
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-2xs'"
                class="w-full text-left p-4 rounded-xl border transition-all cursor-pointer space-y-3 block"
              >
                <!-- Top Row: Date & Status -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 text-xs font-semibold">
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]" [class]="isDateToday(shoot.shootDate) ? 'text-emerald-600' : 'text-stone-400'">
                      event
                    </mat-icon>
                    <span [class]="isDateToday(shoot.shootDate) ? 'text-emerald-700 font-bold' : 'text-stone-700'">
                      {{ formatFriendlyDate(shoot.shootDate) }} • {{ shoot.shootTime }}
                    </span>
                  </div>

                  <span
                    class="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider"
                    [class]="getStatusBadgeClass(shoot.status)"
                  >
                    {{ shoot.status }}
                  </span>
                </div>

                <!-- Title & Concept -->
                <div>
                  <h3 class="text-sm font-bold text-stone-900 leading-snug line-clamp-1">
                    {{ shoot.title }}
                  </h3>
                  <p class="text-xs text-stone-500 line-clamp-1 mt-0.5">
                    {{ shoot.conceptSummary }}
                  </p>
                </div>

                <!-- Scene & Equipment Progress -->
                <div class="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-stone-100">
                  <div class="flex items-center gap-1">
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-stone-400">layers</mat-icon>
                    <span>{{ countCompletedScenes(shoot) }}/{{ shoot.scenes.length }} scenes</span>
                  </div>

                  <div class="flex items-center gap-1">
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-stone-400">check_box</mat-icon>
                    <span>{{ countCheckedEquip(shoot) }}/{{ shoot.equipmentChecklist.length }} gear ready</span>
                  </div>

                  <span class="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium">
                    {{ shoot.targetDuration }}
                  </span>
                </div>
              </button>
            }
          </div>

          <!-- Right Column: Selected Shoot Detailed Inspector (7 cols on lg) -->
          @if (service.selectedSchedule(); as selected) {
            <div class="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-5 sm:p-7 space-y-6 shadow-xs">
              <!-- Top Detail Bar with Title & Status Selector -->
              <div class="space-y-3 pb-5 border-b border-stone-200">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider" [class]="getStatusBadgeClass(selected.status)">
                      {{ selected.status }}
                    </span>
                    <span class="text-xs text-stone-500 flex items-center gap-1">
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">videocam</mat-icon>
                      {{ selected.format }}
                    </span>
                    <span class="text-xs text-stone-500 flex items-center gap-1">
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">timer</mat-icon>
                      {{ selected.targetDuration }}
                    </span>
                  </div>

                  <!-- Quick Status Dropdown & Edit Button -->
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      id="edit-shoot-btn"
                      (click)="onEditSchedule(selected)"
                      class="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-xs font-semibold text-stone-800 cursor-pointer inline-flex items-center gap-1 transition-colors"
                      title="Edit video title, topic, or shoot details"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">edit</mat-icon>
                      <span>Edit Shoot</span>
                    </button>

                    <div class="flex items-center gap-1.5">
                      <span class="text-xs text-stone-500 font-medium">Status:</span>
                      <select
                        [value]="selected.status"
                        (change)="onStatusSelect(selected.id, $event)"
                        class="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-800 cursor-pointer focus:outline-none"
                      >
                        <option value="planned">Planned</option>
                        <option value="filming">Filming Today</option>
                        <option value="recorded">Recorded</option>
                        <option value="editing">Editing</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>
                </div>

                <h3 class="text-xl font-bold text-stone-900 leading-snug">
                  {{ selected.title }}
                </h3>

                <p class="text-xs text-stone-600 leading-relaxed">
                  {{ selected.conceptSummary }}
                </p>

                <div class="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-1">
                  <span class="flex items-center gap-1">
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-emerald-600">calendar_month</mat-icon>
                    <strong class="text-stone-700">Date:</strong> {{ selected.shootDate }} at {{ selected.shootTime }}
                  </span>
                  <span class="flex items-center gap-1">
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-amber-600">place</mat-icon>
                    <strong class="text-stone-700">Location:</strong> {{ selected.location }}
                  </span>
                </div>
              </div>

              <!-- AI Director Plan Banner -->
              <div class="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                    <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-500">auto_awesome</mat-icon>
                    <span>AI Production Assistant</span>
                  </div>
                  <p class="text-[11px] text-stone-500 mt-0.5">
                    Generate an optimized shot-by-shot breakdown and equipment checklist based on this concept.
                  </p>
                </div>

                <button
                  type="button"
                  [disabled]="service.isGeneratingShootPlan()"
                  (click)="onGenerateDirectorPlan(selected)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold shrink-0 cursor-pointer"
                >
                  @if (service.isGeneratingShootPlan()) {
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] animate-spin">refresh</mat-icon>
                    <span>Generating Plan...</span>
                  } @else {
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-amber-400">movie_creation</mat-icon>
                    <span>AI Director Breakdown</span>
                  }
                </button>
              </div>

              <!-- Scene-by-Scene Shot List -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-bold text-stone-900">
                      Shot List & Scene Timing ({{ selected.scenes.length }})
                    </h4>
                    <span class="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                      {{ countCompletedScenes(selected) }} / {{ selected.scenes.length }} Completed
                    </span>
                  </div>

                  <button
                    type="button"
                    (click)="onAddScene(selected)"
                    class="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">add</mat-icon>
                    <span>Add Scene</span>
                  </button>
                </div>

                <div class="space-y-2">
                  @for (scene of selected.scenes; track scene.id; let idx = $index) {
                    <div
                      [class]="scene.isCompleted ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-stone-200'"
                      class="p-3.5 rounded-xl border transition-all space-y-2"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            [checked]="scene.isCompleted"
                            (change)="service.toggleSceneComplete(selected.id, scene.id)"
                            class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 cursor-pointer"
                          />
                          <span
                            class="text-xs font-bold"
                            [class]="scene.isCompleted ? 'line-through text-stone-500' : 'text-stone-900'"
                          >
                            {{ scene.title }}
                          </span>
                        </div>

                        <div class="flex items-center gap-1.5">
                          <span class="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-mono text-stone-600">
                            ~{{ scene.durationSec }}s
                          </span>
                          <button
                            type="button"
                            (click)="onRemoveScene(selected, scene.id)"
                            class="text-stone-400 hover:text-rose-500 p-0.5 cursor-pointer"
                            title="Delete scene"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">delete</mat-icon>
                          </button>
                        </div>
                      </div>

                      <p class="text-xs text-stone-700 leading-relaxed pl-6.5">
                        <strong class="text-stone-900">Script / Action:</strong> {{ scene.description }}
                      </p>

                      @if (scene.visualNotes) {
                        <p class="text-[11px] text-stone-500 italic pl-6.5">
                          <strong class="text-stone-600 not-italic">Visual / Angle:</strong> {{ scene.visualNotes }}
                        </p>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Equipment & Studio Prep Checklist -->
              <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-bold text-stone-900">
                      Gear & Production Checklist ({{ selected.equipmentChecklist.length }})
                    </h4>
                    <span class="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                      {{ countCheckedEquip(selected) }} / {{ selected.equipmentChecklist.length }} Ready
                    </span>
                  </div>

                  <button
                    type="button"
                    (click)="onAddEquipment(selected)"
                    class="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">add</mat-icon>
                    <span>Add Item</span>
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  @for (item of selected.equipmentChecklist; track item.id) {
                    <label
                      class="flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors"
                      [class]="item.checked ? 'bg-emerald-50/50 border-emerald-200 text-stone-500' : 'bg-stone-50/50 border-stone-200 text-stone-800 hover:bg-stone-50'"
                    >
                      <input
                        type="checkbox"
                        [checked]="item.checked"
                        (change)="service.toggleEquipmentCheck(selected.id, item.id)"
                        class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 cursor-pointer"
                      />
                      <span [class]="item.checked ? 'line-through text-stone-400' : ''">
                        {{ item.name }}
                      </span>
                    </label>
                  }
                </div>
              </div>

              <!-- Director Notes -->
              @if (selected.notes) {
                <div class="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs space-y-1">
                  <div class="font-bold text-amber-950 flex items-center gap-1">
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">edit_note</mat-icon>
                    <span>Shoot Notes & Director Tips</span>
                  </div>
                  <p class="text-amber-900 whitespace-pre-line leading-relaxed">
                    {{ selected.notes }}
                  </p>
                </div>
              }

              <!-- Bottom Actions Bar -->
              <div class="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    (click)="onDeleteSchedule(selected.id)"
                    class="text-xs text-rose-600 hover:text-rose-700 font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">delete</mat-icon>
                    <span>Delete Schedule</span>
                  </button>

                  <button
                    type="button"
                    (click)="onEditSchedule(selected)"
                    class="text-xs text-stone-600 hover:text-stone-900 font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">edit</mat-icon>
                    <span>Edit Details</span>
                  </button>
                </div>

                <div class="flex items-center gap-2">
                  <label
                    class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">cloud_upload</mat-icon>
                    <span>Upload Video & Extract Captions</span>
                    <input
                      type="file"
                      accept="video/*,.mp4,.mov,.webm,.m4v,.mkv,.avi,.quicktime"
                      class="hidden"
                      (change)="onShootVideoFileSelected(selected, $event)"
                    />
                  </label>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Modal: Schedule / Edit Video Shoot -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
          <div class="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-stone-200 pb-3">
              <div class="flex items-center gap-2">
                <mat-icon class="text-emerald-600">videocam</mat-icon>
                <h3 class="text-lg font-bold text-stone-900">
                  @if (editingScheduleId()) {
                    Edit Video Shoot
                  } @else {
                    Schedule Video Shoot
                  }
                </h3>
              </div>
              <button
                type="button"
                (click)="closeModal()"
                class="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="createForm" (ngSubmit)="onCreateSubmit()" class="space-y-4 text-xs">
              <!-- Video Title / Topic Selection (Scroll Down from Saved Ideas + Custom) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label for="shoot-title-source-select" class="block font-semibold text-stone-700">
                    Video Title / Topic *
                  </label>
                  @if (selectedSourceIdeaId() && selectedSourceIdeaId() !== '__custom__') {
                    <span class="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 border border-emerald-200">
                      <mat-icon class="!w-3 !h-3 !text-[12px]">bookmark</mat-icon>
                      <span>From Saved Ideas</span>
                    </span>
                  }
                </div>

                <!-- Scroll Down Dropdown -->
                <div class="relative">
                  <select
                    id="shoot-title-source-select"
                    [value]="selectedSourceIdeaId()"
                    (change)="onTitleSourceSelect($event)"
                    class="w-full px-3 py-2.5 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-300 text-stone-900 font-medium focus:outline-none focus:border-stone-500 focus:bg-white transition-all cursor-pointer text-xs"
                  >
                    <option value="__custom__">✍️ Custom — Enter custom video title / topic</option>

                    @if (service.savedIdeas().length > 0) {
                      <optgroup label="📌 Saved Video Ideas ({{ service.savedIdeas().length }})">
                        @for (idea of service.savedIdeas(); track idea.id) {
                          <option [value]="idea.id">Saved: {{ idea.title }}</option>
                        }
                      </optgroup>
                    }

                    @if (availableBrainstormedIdeas().length > 0) {
                      <optgroup label="💡 Brainstormed Ideas ({{ availableBrainstormedIdeas().length }})">
                        @for (idea of availableBrainstormedIdeas(); track idea.id) {
                          <option [value]="idea.id">Idea: {{ idea.title }}</option>
                        }
                      </optgroup>
                    }
                  </select>
                </div>

                <!-- Text Input for Title (allows refining or typing custom title) -->
                <div>
                  <input
                    id="shoot-title-input"
                    type="text"
                    formControlName="title"
                    (input)="onTitleInput()"
                    placeholder="e.g. 5 Costly Creator Mistakes That Kill Views"
                    class="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400 text-xs"
                  />
                </div>

                <div class="flex items-center justify-between text-[11px] text-stone-500">
                  <span>Choose from your saved ideas in the scroll-down above or select custom to type your own.</span>
                  @if (selectedSourceIdeaId() !== '__custom__') {
                    <button
                      type="button"
                      (click)="resetToCustomTitle()"
                      class="text-emerald-700 hover:text-emerald-800 font-semibold underline ml-2 cursor-pointer shrink-0"
                    >
                      Clear to custom
                    </button>
                  }
                </div>
              </div>

              <div>
                <label for="shoot-concept-input" class="block font-semibold text-stone-700 mb-1">Concept Summary / Main Hook</label>
                <textarea
                  id="shoot-concept-input"
                  rows="2"
                  formControlName="conceptSummary"
                  placeholder="Briefly describe what you'll teach or demonstrate..."
                  class="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="shoot-date-input" class="block font-semibold text-stone-700 mb-1">Shoot Date *</label>
                  <input
                    id="shoot-date-input"
                    type="date"
                    formControlName="shootDate"
                    class="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>

                <div>
                  <label for="shoot-time-input" class="block font-semibold text-stone-700 mb-1">Time</label>
                  <input
                    id="shoot-time-input"
                    type="time"
                    formControlName="shootTime"
                    class="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="shoot-format-select" class="block font-semibold text-stone-700 mb-1">Video Format</label>
                  <select
                    id="shoot-format-select"
                    formControlName="format"
                    class="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400 cursor-pointer"
                  >
                    <option value="9:16 Reel / Short">9:16 Reel / Short</option>
                    <option value="16:9 Landscape">16:9 Landscape</option>
                    <option value="Talking Head">Talking Head</option>
                    <option value="Tutorial / Screencast">Tutorial / Screencast</option>
                    <option value="B-Roll Showcase">B-Roll Showcase</option>
                  </select>
                </div>

                <div>
                  <label for="shoot-duration-select" class="block font-semibold text-stone-700 mb-1">Target Duration</label>
                  <select
                    id="shoot-duration-select"
                    formControlName="targetDuration"
                    class="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400 cursor-pointer"
                  >
                    <option value="30s">30 seconds (Snappy)</option>
                    <option value="45-60s">45 - 60 seconds (Standard)</option>
                    <option value="90s">90 seconds (Deep Dive)</option>
                    <option value="2-3 min">2 - 3 minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label for="shoot-location-input" class="block font-semibold text-stone-700 mb-1">Location / Studio Setting</label>
                <input
                  id="shoot-location-input"
                  type="text"
                  formControlName="location"
                  placeholder="e.g. Studio Desk Setup, Home Office, Outdoor"
                  class="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div class="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  (click)="closeModal()"
                  class="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="createForm.invalid"
                  class="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold cursor-pointer"
                >
                  @if (editingScheduleId()) {
                    Update Shoot Schedule
                  } @else {
                    Save to Schedule
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class ShootSchedule {
  readonly service = inject(ContentCreator);

  readonly activeFilter = signal<ScheduleFilter>('all');
  readonly searchQuery = signal<string>('');
  readonly showCreateModal = signal<boolean>(false);
  readonly selectedSourceIdeaId = signal<string>('__custom__');
  readonly editingScheduleId = signal<string | null>(null);

  readonly todayStr = new Date().toISOString().split('T')[0];

  readonly createForm = new FormGroup({
    title: new FormControl('', [Validators.required]),
    conceptSummary: new FormControl(''),
    shootDate: new FormControl(this.todayStr, [Validators.required]),
    shootTime: new FormControl('14:00'),
    location: new FormControl('Studio Desk Setup'),
    format: new FormControl('9:16 Reel / Short'),
    targetDuration: new FormControl('45-60s'),
  });

  readonly availableBrainstormedIdeas = computed(() => {
    const savedIds = new Set(this.service.savedIdeas().map((i) => i.id));
    return this.service.ideas().filter((i) => !savedIds.has(i.id));
  });

  readonly todayCount = computed(() => {
    return this.service.schedules().filter((s) => s.shootDate === this.todayStr || s.status === 'filming').length;
  });

  readonly upcomingCount = computed(() => {
    return this.service.schedules().filter((s) => s.shootDate > this.todayStr && s.status === 'planned').length;
  });

  readonly recordedCount = computed(() => {
    return this.service.schedules().filter((s) => s.status === 'recorded' || s.status === 'editing').length;
  });

  readonly filteredSchedules = computed(() => {
    const filter = this.activeFilter();
    const query = this.searchQuery().toLowerCase().trim();
    let list = this.service.schedules();

    if (filter === 'today') {
      list = list.filter((s) => s.shootDate === this.todayStr || s.status === 'filming');
    } else if (filter === 'upcoming') {
      list = list.filter((s) => s.shootDate >= this.todayStr && s.status === 'planned');
    } else if (filter === 'recorded') {
      list = list.filter((s) => s.status === 'recorded' || s.status === 'editing');
    } else if (filter === 'completed') {
      list = list.filter((s) => s.status === 'published');
    }

    if (query) {
      list = list.filter((s) => s.title.toLowerCase().includes(query) || s.conceptSummary.toLowerCase().includes(query));
    }

    return list;
  });

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  isDateToday(dateStr: string): boolean {
    return dateStr === this.todayStr;
  }

  formatFriendlyDate(dateStr: string): string {
    if (dateStr === this.todayStr) return 'Today';
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateStr === tomorrow) return 'Tomorrow';
    return dateStr;
  }

  getStatusBadgeClass(status: ShootStatus): string {
    switch (status) {
      case 'filming':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'planned':
        return 'bg-amber-100 text-amber-900 border border-amber-200';
      case 'recorded':
        return 'bg-indigo-100 text-indigo-900 border border-indigo-200';
      case 'editing':
        return 'bg-purple-100 text-purple-900 border border-purple-200';
      case 'published':
        return 'bg-stone-100 text-stone-700 border border-stone-200';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  }

  countCompletedScenes(shoot: VideoShootSchedule): number {
    return shoot.scenes.filter((s) => s.isCompleted).length;
  }

  countCheckedEquip(shoot: VideoShootSchedule): number {
    return shoot.equipmentChecklist.filter((e) => e.checked).length;
  }

  onStatusSelect(shootId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.service.updateShootStatus(shootId, select.value as ShootStatus);
  }

  onGenerateDirectorPlan(shoot: VideoShootSchedule): void {
    this.service.generateAiShootPlan({
      title: shoot.title,
      conceptSummary: shoot.conceptSummary,
      format: shoot.format,
      targetDuration: shoot.targetDuration,
      location: shoot.location,
    });
  }

  onAddScene(shoot: VideoShootSchedule): void {
    const newIdx = shoot.scenes.length + 1;
    const newScenes = [
      ...shoot.scenes,
      {
        id: `sc-${Date.now()}-${newIdx}`,
        title: `Scene ${newIdx}: Key Point`,
        description: 'Detail action or talking point here...',
        durationSec: 15,
        visualNotes: 'Medium shot',
        isCompleted: false,
      },
    ];
    this.service.updateSchedule(shoot.id, { scenes: newScenes });
  }

  onRemoveScene(shoot: VideoShootSchedule, sceneId: string): void {
    const filtered = shoot.scenes.filter((s) => s.id !== sceneId);
    this.service.updateSchedule(shoot.id, { scenes: filtered });
  }

  onAddEquipment(shoot: VideoShootSchedule): void {
    const itemName = prompt('Enter gear or checklist item (e.g. Teleprompter app, extra battery):');
    if (!itemName?.trim()) return;

    const updated = [
      ...shoot.equipmentChecklist,
      {
        id: `eq-${Date.now()}`,
        name: itemName.trim(),
        checked: false,
      },
    ];
    this.service.updateSchedule(shoot.id, { equipmentChecklist: updated });
  }

  onDeleteSchedule(id: string): void {
    if (confirm('Are you sure you want to delete this scheduled shoot?')) {
      this.service.deleteSchedule(id);
    }
  }

  async onShootVideoFileSelected(shoot: VideoShootSchedule, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      input.value = '';
      this.service.selectSchedule(shoot);
      await this.service.loadVideoFile(file, shoot.id);
      this.service.activeTab.set('captions');
      await this.service.separateCaptionsForFile(file);
    }
  }

  onUploadVideoForShoot(shoot: VideoShootSchedule): void {
    this.service.selectSchedule(shoot);
    this.service.activeTab.set('captions');
  }

  matchDuration(raw?: string): string {
    if (!raw) return '45-60s';
    const lower = raw.toLowerCase();
    if (lower.includes('30s') || lower.includes('30 sec')) return '30s';
    if (lower.includes('45') || lower.includes('60') || lower.includes('1 min')) return '45-60s';
    if (lower.includes('90')) return '90s';
    if (lower.includes('2-3') || lower.includes('2 min') || lower.includes('3 min')) return '2-3 min';
    return '45-60s';
  }

  matchFormat(raw?: string): string {
    if (!raw) return '9:16 Reel / Short';
    const lower = raw.toLowerCase();
    if (lower.includes('16:9') || lower.includes('landscape') || lower.includes('youtube')) return '16:9 Landscape';
    if (lower.includes('talking head')) return 'Talking Head';
    if (lower.includes('tutorial') || lower.includes('screen')) return 'Tutorial / Screencast';
    if (lower.includes('b-roll')) return 'B-Roll Showcase';
    return '9:16 Reel / Short';
  }

  onTitleSourceSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const val = select.value;
    this.selectedSourceIdeaId.set(val);

    if (val === '__custom__') {
      return;
    }

    const found =
      this.service.savedIdeas().find((i) => i.id === val) ||
      this.service.ideas().find((i) => i.id === val);

    if (found) {
      this.createForm.patchValue({
        title: found.title,
        conceptSummary: found.conceptSummary || found.hook || '',
        format: this.matchFormat(found.format),
        targetDuration: this.matchDuration(found.estimatedDuration),
      });
    }
  }

  onTitleInput(): void {
    const currentTitle = this.createForm.get('title')?.value || '';
    const currentId = this.selectedSourceIdeaId();
    if (currentId !== '__custom__') {
      const found =
        this.service.savedIdeas().find((i) => i.id === currentId) ||
        this.service.ideas().find((i) => i.id === currentId);
      if (!found || found.title !== currentTitle) {
        this.selectedSourceIdeaId.set('__custom__');
      }
    }
  }

  resetToCustomTitle(): void {
    this.selectedSourceIdeaId.set('__custom__');
    this.createForm.patchValue({
      title: '',
      conceptSummary: '',
    });
  }

  onOpenCreateModal(): void {
    this.editingScheduleId.set(null);
    this.selectedSourceIdeaId.set('__custom__');
    this.createForm.reset({
      title: '',
      conceptSummary: '',
      shootDate: this.todayStr,
      shootTime: '14:00',
      location: 'Studio Desk Setup',
      format: '9:16 Reel / Short',
      targetDuration: '45-60s',
    });
    this.showCreateModal.set(true);
  }

  onEditSchedule(shoot: VideoShootSchedule): void {
    this.editingScheduleId.set(shoot.id);
    const matchingIdea =
      this.service.savedIdeas().find((i) => i.id === shoot.linkedIdeaId || i.title === shoot.title) ||
      this.service.ideas().find((i) => i.id === shoot.linkedIdeaId || i.title === shoot.title);

    this.selectedSourceIdeaId.set(matchingIdea ? matchingIdea.id : '__custom__');

    this.createForm.setValue({
      title: shoot.title,
      conceptSummary: shoot.conceptSummary,
      shootDate: shoot.shootDate,
      shootTime: shoot.shootTime,
      location: shoot.location,
      format: shoot.format,
      targetDuration: shoot.targetDuration,
    });
    this.showCreateModal.set(true);
  }

  closeModal(): void {
    this.showCreateModal.set(false);
    this.editingScheduleId.set(null);
  }

  onCreateSubmit(): void {
    if (this.createForm.invalid) return;

    const val = this.createForm.value;
    if (this.editingScheduleId()) {
      const id = this.editingScheduleId()!;
      this.service.updateSchedule(id, {
        title: val.title || 'Untitled Shoot',
        conceptSummary: val.conceptSummary || '',
        shootDate: val.shootDate || this.todayStr,
        shootTime: val.shootTime || '14:00',
        location: val.location || 'Studio Desk Setup',
        format: val.format || '9:16 Reel / Short',
        targetDuration: val.targetDuration || '45-60s',
        linkedIdeaId: this.selectedSourceIdeaId() !== '__custom__' ? this.selectedSourceIdeaId() : undefined,
      });
    } else {
      this.service.createSchedule({
        title: val.title || 'Untitled Shoot',
        conceptSummary: val.conceptSummary || '',
        shootDate: val.shootDate || this.todayStr,
        shootTime: val.shootTime || '14:00',
        location: val.location || 'Studio Desk Setup',
        format: val.format || '9:16 Reel / Short',
        targetDuration: val.targetDuration || '45-60s',
        linkedIdeaId: this.selectedSourceIdeaId() !== '__custom__' ? this.selectedSourceIdeaId() : undefined,
      });
    }

    this.closeModal();
  }
}
