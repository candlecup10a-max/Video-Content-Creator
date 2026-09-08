import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ReactiveFormsModule} from '@angular/forms';
import {ContentCreator} from '../services/content-creator';
import {CaptionSegment} from '../models/content.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-caption-separator',
  imports: [MatIconModule, ReactiveFormsModule],
  template: `
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onFileDrop($event)"
    >
      <!-- Drag & Drop Full-Page Visual Cue -->
      @if (isDragging()) {
        <div class="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center pointer-events-none p-6 animate-fade-in">
          <div class="bg-white rounded-3xl p-8 max-w-md text-center shadow-2xl border-2 border-dashed border-indigo-500 space-y-3">
            <div class="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <mat-icon class="!w-8 !h-8 !text-[32px]">cloud_upload</mat-icon>
            </div>
            <h3 class="text-lg font-bold text-stone-900">Drop Video to Load</h3>
            <p class="text-xs text-stone-500">Release your video file anywhere to load it and generate synchronized captions.</p>
          </div>
        </div>
      }

      <!-- Section Header -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800">
              <mat-icon class="!w-5 !h-5 !text-[20px]">subtitles</mat-icon>
            </span>
            <h2 class="text-2xl font-bold text-stone-900 tracking-tight">Video Upload & Separated Captions</h2>
          </div>
          <p class="text-sm text-stone-600 mt-1">
            Upload your recorded video, separate synchronized timestamped captions with AI, edit lines, and export .SRT / .VTT.
          </p>
        </div>

        <div class="flex items-center gap-3">
          @if (service.activeCaptionProject()) {
            <button
              type="button"
              (click)="service.createNewCaptionProject()"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">add</mat-icon>
              <span>Upload New Video</span>
            </button>
          }

          <button
            type="button"
            (click)="loadDemoVideo()"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-500">play_circle</mat-icon>
            <span>Load Demo Video & Captions</span>
          </button>
        </div>
      </div>

      <!-- Audio Extraction & Transcription Progress Banner -->
      @if (service.captionExtractionProgress(); as progress) {
        <div class="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <mat-icon class="!w-4 !h-4 !text-[16px] animate-spin">sync</mat-icon>
            </div>
            <div>
              <p class="font-bold text-indigo-900">{{ progress }}</p>
              <p class="text-[11px] text-indigo-700 mt-0.5">True speech recognition & precise time boundary alignment in progress.</p>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800 font-mono font-semibold text-[11px] shrink-0">
            Analyzing Audio
          </span>
        </div>
      }

      <!-- Speech Analysis Notice / Warning -->
      @if (service.activeCaptionProject()?.analysisNotice; as notice) {
        <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-600 shrink-0 mt-0.5">info</mat-icon>
          <div class="space-y-1">
            <span class="font-semibold">{{ notice }}</span>
            <p class="text-amber-800 text-[11px]">
              If your video has faint voice or background music, you can also generate synchronized captions by clicking <strong>"From Script"</strong>.
            </p>
          </div>
        </div>
      }

      <!-- Upload Status Banner -->
      @if (uploadStatusMessage(); as status) {
        <div class="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2.5 animate-fade-in shadow-xs">
          <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600 animate-spin">refresh</mat-icon>
          <span class="font-medium">{{ status }}</span>
        </div>
      }

      <!-- Error / Notice Banner -->
      @if (service.errorMessage()) {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <mat-icon class="text-rose-600">error_outline</mat-icon>
            <span>{{ service.errorMessage() }}</span>
          </div>
          <button
            type="button"
            (click)="onRetryCaptionSeparation()"
            class="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      }

      <!-- Main Layout: If no video is active, show Upload Zone; else show Video Studio & Caption Timeline -->
      @if (!service.activeCaptionProject(); as project) {
        <!-- Upload Zone -->
        <div
          class="bg-white rounded-3xl border-2 border-dashed border-stone-300 p-8 sm:p-14 text-center space-y-5 transition-colors"
          [class.border-indigo-500]="isDragging()"
          [class.bg-indigo-50/20]="isDragging()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onFileDrop($event)"
        >
          <div class="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
            <mat-icon class="!w-8 !h-8 !text-[32px]">cloud_upload</mat-icon>
          </div>

          <div class="max-w-md mx-auto space-y-2">
            <h3 class="text-lg font-bold text-stone-900">Upload Your Video File</h3>
            <p class="text-xs text-stone-500">
              Drag and drop your recorded MP4, WebM, MOV, or M4V video here. The program will play your video and separate speech into timed captions.
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
            <label
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">folder_open</mat-icon>
              <span>Browse Video File</span>
              <input
                type="file"
                accept="video/*,.mp4,.mov,.webm,.m4v,.mkv,.avi,.quicktime"
                class="hidden"
                (change)="onFileSelected($event)"
              />
            </label>

            <button
              type="button"
              (click)="loadDemoVideo()"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600">movie</mat-icon>
              <span>Explore With Demo Video</span>
            </button>
          </div>

          <!-- Video format support notes -->
          <div class="pt-6 border-t border-stone-100 flex items-center justify-center gap-6 text-[11px] text-stone-400">
            <span>✓ MP4, WebM, QuickTime MOV</span>
            <span>✓ Zero upload delay (client playback)</span>
            <span>✓ AI Timestamp synchronization</span>
          </div>
        </div>
      } @else {
        <!-- Active Video Studio & Caption Workspace -->
        <div class="space-y-6">
          <!-- Top Project Info & Action Ribbon -->
          <div class="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <mat-icon class="!w-5 !h-5 !text-[20px]">movie</mat-icon>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base font-bold text-stone-900 truncate">
                    {{ service.activeCaptionProject()?.title }}
                  </h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {{ service.activeCaptionProject()?.captions?.length || 0 }} Captions
                  </span>
                  @if (service.activeCaptionProject()?.transcriptionSource === 'audio_analysis') {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                      <mat-icon class="!w-3 !h-3 !text-[12px]">mic</mat-icon>
                      <span>Speech Audio Analyzed</span>
                    </span>
                  } @else if (service.activeCaptionProject()?.transcriptionSource === 'manual_script') {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                      <mat-icon class="!w-3 !h-3 !text-[12px]">article</mat-icon>
                      <span>Script Synchronized</span>
                    </span>
                  }
                  @if (service.activeCaptionProject()?.durationSeconds; as dur) {
                    <span class="text-xs text-stone-500 font-mono">
                      {{ formatSeconds(dur) }}
                    </span>
                  }
                </div>
                <p class="text-xs text-stone-500 truncate mt-0.5">
                  File: {{ service.activeCaptionProject()?.fileName }} ({{ formatFileSize(service.activeCaptionProject()?.fileSize || 0) }})
                </p>
              </div>
            </div>

            <!-- Action Controls -->
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                [disabled]="service.isSeparatingCaptions()"
                (click)="onTriggerCaptionSeparation()"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                @if (service.isSeparatingCaptions()) {
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px] animate-spin">refresh</mat-icon>
                  <span>{{ service.captionExtractionProgress() || 'Separating Speech...' }}</span>
                } @else {
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">auto_awesome</mat-icon>
                  <span>Analyze Speech & Separate</span>
                }
              </button>

              <button
                type="button"
                (click)="showScriptInput.set(!showScriptInput())"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium cursor-pointer"
                title="Input spoken script or outline to auto-time captions"
              >
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-stone-500">article</mat-icon>
                <span>{{ showScriptInput() ? 'Hide Script' : 'From Script' }}</span>
              </button>

              <label
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium cursor-pointer"
                title="Replace with another video file"
              >
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-stone-500">upload_file</mat-icon>
                <span>Replace Video</span>
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.webm,.m4v,.mkv,.avi,.quicktime"
                  class="hidden"
                  (change)="onFileSelected($event)"
                />
              </label>

              <button
                type="button"
                (click)="service.createNewCaptionProject()"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                title="Upload a new video project"
              >
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-stone-600">add</mat-icon>
                <span>New Video</span>
              </button>
            </div>
          </div>

          <!-- Script / Speech Input Bar (Collapsible) -->
          @if (showScriptInput()) {
            <div class="bg-indigo-50/60 rounded-2xl border border-indigo-100 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600">psychology</mat-icon>
                  <span>Script & Spoken Outline to Timed Captions</span>
                </span>
                <span class="text-[11px] text-indigo-700">
                  Gemini will synchronize and break this text into rhythmic caption cards
                </span>
              </div>

              <textarea
                [value]="customScriptText()"
                (input)="onScriptInputChange($event)"
                rows="3"
                placeholder="Paste or type your video script, speech transcript, or bullet points here..."
                class="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-indigo-400 resize-none"
              ></textarea>

              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  [disabled]="service.isSeparatingCaptions() || !customScriptText().trim()"
                  (click)="onSeparateFromScript()"
                  class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  Generate Separated Captions from Script
                </button>
              </div>
            </div>
          }

          <!-- Grid: Left = Video Player & Live On-Screen Captions; Right = Separated Caption Segments -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Left: Video Player (5 cols on lg) -->
            <div class="lg:col-span-5 space-y-4">
              <div class="bg-stone-900 rounded-2xl overflow-hidden shadow-md border border-stone-800 relative">
                <!-- Video Element -->
                @if (service.activeCaptionProject()?.videoUrl && !videoPlaybackError(); as url) {
                  <video
                    #videoPlayer
                    [src]="url"
                    playsinline
                    (timeupdate)="onVideoTimeUpdate()"
                    (loadedmetadata)="onVideoLoadedMetadata()"
                    (error)="onVideoPlayerError()"
                    (play)="service.setVideoPlaying(true)"
                    (pause)="service.setVideoPlaying(false)"
                    (ended)="service.setVideoPlaying(false)"
                    class="w-full aspect-9/16 max-h-[500px] object-contain bg-black mx-auto"
                  ></video>
                } @else {
                  <!-- Relink Video / Preview Visualizer Card -->
                  <div class="w-full aspect-9/16 max-h-[500px] bg-gradient-to-b from-stone-900 via-stone-850 to-stone-950 flex flex-col items-center justify-center p-6 text-center text-white relative">
                    <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-3 backdrop-blur-xs">
                      <mat-icon class="!w-7 !h-7 !text-[28px] text-indigo-400">videocam</mat-icon>
                    </div>
                    <span class="text-sm font-bold">
                      {{ videoPlaybackError() ? 'Video Playback Notice' : (service.activeCaptionProject()?.fileName ? 'Connect Video File' : 'Demo Video Playback') }}
                    </span>
                    <p class="text-[11px] text-stone-400 max-w-xs mt-1 mb-4 leading-relaxed">
                      @if (videoPlaybackError()) {
                        Browser format preview unavailable, but captions and export are fully active. Select file to reload playback.
                      } @else if (service.activeCaptionProject()?.fileName) {
                        Video loaded from previous session. Choose the video file to enable live playback synchronization.
                      } @else {
                        Simulated 24.5s creator reel with synchronized audio track.
                      }
                    </p>

                    <label class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                      <mat-icon class="!w-4 !h-4 !text-[16px]">folder_open</mat-icon>
                      <span>{{ service.activeCaptionProject()?.fileName ? 'Select Video File' : 'Browse Video File' }}</span>
                      <input
                        type="file"
                        accept="video/*,.mp4,.mov,.webm,.m4v,.mkv,.avi,.quicktime"
                        class="hidden"
                        (change)="onRelinkFileSelected($event)"
                      />
                    </label>
                  </div>
                }

                <!-- Live Subtitle Overlay on Video (Modern TikTok / Reels Aesthetic) -->
                @if (activeCaptionSegment(); as active) {
                  <div class="absolute bottom-16 inset-x-4 flex justify-center pointer-events-none">
                    <div class="bg-stone-950/85 backdrop-blur-xs px-4 py-2 rounded-xl text-center max-w-[90%] shadow-lg border border-white/15 animate-fade-in">
                      <p class="text-sm sm:text-base font-extrabold text-white tracking-wide leading-tight drop-shadow-md">
                        {{ active.text }}
                      </p>
                    </div>
                  </div>
                }

                <!-- Custom Player Controls Bar -->
                <div class="bg-stone-900/95 px-4 py-3 border-t border-stone-800 space-y-2 text-white text-xs">
                  <!-- Progress Slider -->
                  <input
                    type="range"
                    min="0"
                    [max]="totalDuration()"
                    step="0.1"
                    [value]="service.videoCurrentTime()"
                    (input)="onSeekSliderChange($event)"
                    class="w-full accent-indigo-500 h-1.5 bg-stone-700 rounded-lg cursor-pointer"
                  />

                  <!-- Buttons & Time -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        (click)="togglePlayPause()"
                        class="w-8 h-8 rounded-full bg-white text-stone-900 flex items-center justify-center hover:bg-stone-100 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">
                          {{ service.isVideoPlaying() ? 'pause' : 'play_arrow' }}
                        </mat-icon>
                      </button>

                      <button
                        type="button"
                        (click)="seekRelative(-5)"
                        class="p-1 text-stone-400 hover:text-white cursor-pointer"
                        title="Rewind 5s"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">replay_5</mat-icon>
                      </button>

                      <button
                        type="button"
                        (click)="seekRelative(5)"
                        class="p-1 text-stone-400 hover:text-white cursor-pointer"
                        title="Forward 5s"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">forward_5</mat-icon>
                      </button>

                      <span class="font-mono text-[11px] text-stone-300 ml-1">
                        {{ formatSeconds(service.videoCurrentTime()) }} / {{ formatSeconds(totalDuration()) }}
                      </span>
                    </div>

                    <div class="flex items-center gap-1.5 text-[11px] text-stone-400">
                      <span class="w-2 h-2 rounded-full" [class]="service.isVideoPlaying() ? 'bg-emerald-400 animate-ping' : 'bg-stone-600'"></span>
                      <span>{{ service.isVideoPlaying() ? 'Playing' : 'Paused' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Quick Export & Transfer Card -->
              <div class="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                <div class="flex items-center justify-between text-xs font-bold text-stone-900">
                  <span class="flex items-center gap-1.5">
                    <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600">file_download</mat-icon>
                    <span>Export & Publish</span>
                  </span>
                  <span class="text-[11px] text-stone-500 font-normal">Industry formats</span>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="service.exportCaptions('srt')"
                    class="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-indigo-600">download</mat-icon>
                    <span>Download .SRT</span>
                  </button>

                  <button
                    type="button"
                    (click)="service.exportCaptions('vtt')"
                    class="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-indigo-600">download</mat-icon>
                    <span>Download .VTT</span>
                  </button>
                </div>

                <!-- Bridge to Social Posts Generator -->
                <button
                  type="button"
                  (click)="service.sendCaptionsToSocialPackage()"
                  class="w-full px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-400">share</mat-icon>
                  <span>Create Social Posts from This Video</span>
                </button>
              </div>
            </div>

            <!-- Right: Separated Captions Timeline (7 cols on lg) -->
            <div class="lg:col-span-7 space-y-4">
              <!-- Caption Timeline Bar -->
              <div class="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between gap-3 shadow-xs">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-stone-900">
                    Separated Caption Segments ({{ currentCaptions().length }})
                  </h4>
                  <span class="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                    Click time to jump video
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <!-- Timing Shift Buttons -->
                  <div class="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg text-xs" title="Nudge all subtitle timings">
                    <button
                      type="button"
                      (click)="service.shiftAllCaptions(-0.5)"
                      class="px-2 py-1 hover:bg-white rounded text-[11px] font-mono text-stone-700 cursor-pointer"
                    >
                      -0.5s
                    </button>
                    <button
                      type="button"
                      (click)="service.shiftAllCaptions(0.5)"
                      class="px-2 py-1 hover:bg-white rounded text-[11px] font-mono text-stone-700 cursor-pointer"
                    >
                      +0.5s
                    </button>
                  </div>

                  <button
                    type="button"
                    (click)="service.addCaptionSegment()"
                    class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">add</mat-icon>
                    <span>Add Line</span>
                  </button>
                </div>
              </div>

              <!-- Caption Cards List -->
              @if (currentCaptions().length === 0) {
                @if (service.isSeparatingCaptions()) {
                  <div class="p-12 text-center bg-white rounded-2xl border border-indigo-200 space-y-4 shadow-2xs">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                      <mat-icon class="!w-6 !h-6 !text-[24px] animate-spin">refresh</mat-icon>
                    </div>
                    <div class="space-y-1">
                      <h5 class="text-sm font-bold text-stone-900">
                        {{ service.captionExtractionProgress() || 'Transcribing Video Speech...' }}
                      </h5>
                      <p class="text-xs text-stone-500 max-w-sm mx-auto">
                        Decoding audio, running speech recognition, and matching precise subtitle timing blocks...
                      </p>
                    </div>
                  </div>
                } @else {
                  <div class="p-10 text-center bg-white rounded-2xl border border-dashed border-stone-300 space-y-3">
                    <mat-icon class="!w-8 !h-8 !text-[32px] text-stone-300 mx-auto">subtitles_off</mat-icon>
                    <p class="text-xs text-stone-500 max-w-sm mx-auto">
                      No captions separated yet. Click "Analyze Speech & Separate" to transcribe the real spoken audio, or paste your script.
                    </p>
                    <div class="flex items-center justify-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        (click)="onTriggerCaptionSeparation()"
                        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">auto_awesome</mat-icon>
                        <span>Analyze Speech & Separate</span>
                      </button>
                      <button
                        type="button"
                        (click)="showScriptInput.set(true)"
                        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-stone-500">article</mat-icon>
                        <span>Paste Script</span>
                      </button>
                    </div>
                  </div>
                }
              } @else {
                <div class="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
                  @for (cap of currentCaptions(); track cap.id; let idx = $index) {
                    <div
                      [id]="'caption-card-' + cap.id"
                      [class]="isCaptionActive(cap) 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30 shadow-xs' 
                        : 'border-stone-200 bg-white hover:border-stone-300'"
                      class="p-3.5 rounded-xl border transition-all space-y-2"
                    >
                      <!-- Top Row: Index, Timestamp, and Controls -->
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <span
                            class="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold"
                            [class]="isCaptionActive(cap) ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-700'"
                          >
                            #{{ cap.index }}
                          </span>

                          <!-- Clickable Timestamp Pill: Jumps to exact second in video! -->
                          <button
                            type="button"
                            (click)="seekTo(cap.startSeconds)"
                            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer"
                            [class]="isCaptionActive(cap) ? 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'"
                            title="Jump video to this timestamp"
                          >
                            <mat-icon class="!w-3 !h-3 !text-[12px] text-indigo-600">play_arrow</mat-icon>
                            <span>{{ cap.startTime }} ➔ {{ cap.endTime }}</span>
                          </button>

                          <span class="text-[10px] text-stone-400 font-mono">
                            ({{ (cap.endSeconds - cap.startSeconds).toFixed(1) }}s)
                          </span>
                        </div>

                        <!-- Card Action Buttons -->
                        <div class="flex items-center gap-1">
                          <!-- Micro timing adjustments -->
                          <button
                            type="button"
                            (click)="adjustSegmentTime(cap, -0.2)"
                            class="p-1 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
                            title="Nudge start time -0.2s"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">fast_rewind</mat-icon>
                          </button>
                          <button
                            type="button"
                            (click)="adjustSegmentTime(cap, 0.2)"
                            class="p-1 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
                            title="Nudge start time +0.2s"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">fast_forward</mat-icon>
                          </button>

                          <button
                            type="button"
                            (click)="service.addCaptionSegment(idx)"
                            class="p-1 text-stone-400 hover:text-indigo-600 rounded cursor-pointer"
                            title="Insert caption segment below"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">playlist_add</mat-icon>
                          </button>

                          <button
                            type="button"
                            (click)="service.removeCaptionSegment(cap.id)"
                            class="p-1 text-stone-400 hover:text-rose-500 rounded cursor-pointer"
                            title="Delete this caption segment"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">close</mat-icon>
                          </button>
                        </div>
                      </div>

                      <!-- Editable Caption Text Input -->
                      <input
                        type="text"
                        [value]="cap.text"
                        (input)="onCaptionTextChange(cap.id, $event)"
                        class="w-full px-3 py-1.5 rounded-lg bg-stone-50/70 border border-stone-200 text-xs sm:text-sm text-stone-900 focus:bg-white focus:outline-none focus:border-indigo-400 transition-all font-medium"
                      />
                    </div>
                  }
                </div>
              }

              <!-- Full Transcript Preview Box -->
              @if (service.activeCaptionProject()?.fullTranscript; as transcript) {
                <div class="p-4 rounded-xl bg-white border border-stone-200 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-stone-500">description</mat-icon>
                      <span>Full Continuous Transcript</span>
                    </span>
                    <button
                      type="button"
                      (click)="copyTranscript(transcript)"
                      class="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      <mat-icon class="!w-3 !h-3 !text-[12px]">{{ copiedTranscript() ? 'check' : 'content_copy' }}</mat-icon>
                      <span>{{ copiedTranscript() ? 'Copied!' : 'Copy All' }}</span>
                    </button>
                  </div>
                  <p class="text-xs text-stone-600 leading-relaxed max-h-32 overflow-y-auto">
                    {{ transcript }}
                  </p>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CaptionSeparator {
  readonly service = inject(ContentCreator);

  readonly videoPlayer = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  readonly isDragging = signal<boolean>(false);
  readonly showScriptInput = signal<boolean>(false);
  readonly customScriptText = signal<string>('');
  readonly copiedTranscript = signal<boolean>(false);
  readonly videoPlaybackError = signal<boolean>(false);
  readonly uploadStatusMessage = signal<string | null>(null);

  readonly currentCaptions = computed(() => {
    return this.service.activeCaptionProject()?.captions || [];
  });

  readonly totalDuration = computed(() => {
    return this.service.activeCaptionProject()?.durationSeconds || 24.5;
  });

  readonly activeCaptionSegment = computed<CaptionSegment | null>(() => {
    const time = this.service.videoCurrentTime();
    const captions = this.currentCaptions();
    return captions.find((c) => time >= c.startSeconds && time <= c.endSeconds) || null;
  });

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleIncomingFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      input.value = '';
      this.handleIncomingFile(file);
    }
  }

  async onRelinkFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      input.value = '';
      this.videoPlaybackError.set(false);
      await this.service.relinkVideoFile(file);
    }
  }

  onVideoPlayerError(): void {
    this.videoPlaybackError.set(true);
  }

  async handleIncomingFile(file: File): Promise<void> {
    try {
      if (!file) return;
      this.videoPlaybackError.set(false);
      this.uploadStatusMessage.set(`Loading "${file.name}"...`);
      await this.service.loadVideoFile(file);
      this.uploadStatusMessage.set(`Separating speech for "${file.name}"...`);
      await this.service.separateCaptionsForFile(file);
      this.uploadStatusMessage.set(null);
    } catch (err) {
      console.error('Video upload error:', err);
      this.uploadStatusMessage.set(null);
      this.service.errorMessage.set('Could not load video file. Please try selecting an MP4, MOV, or WebM file.');
    }
  }

  loadDemoVideo(): void {
    this.service.loadDemoVideoProject();
  }

  onVideoLoadedMetadata(): void {
    const el = this.videoPlayer()?.nativeElement;
    if (el && el.duration && !isNaN(el.duration)) {
      this.service.setProjectVideoDuration(el.duration);
    }
  }

  onVideoTimeUpdate(): void {
    const el = this.videoPlayer()?.nativeElement;
    if (el) {
      this.service.setVideoCurrentTime(el.currentTime);
    }
  }

  togglePlayPause(): void {
    const el = this.videoPlayer()?.nativeElement;
    if (!el) {
      // Toggle demo timer simulation if no HTML5 video element exists
      this.simulateDemoPlayback();
      return;
    }

    if (el.paused) {
      el.play();
    } else {
      el.pause();
    }
  }

  private demoInterval: number | null = null;
  private simulateDemoPlayback(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
      this.service.setVideoPlaying(false);
      return;
    }

    this.service.setVideoPlaying(true);
    this.demoInterval = window.setInterval(() => {
      let t = this.service.videoCurrentTime() + 0.1;
      if (t >= this.totalDuration()) {
        t = 0;
      }
      this.service.setVideoCurrentTime(t);
    }, 100);
  }

  seekTo(seconds: number): void {
    const clamped = Math.max(0, seconds);
    const el = this.videoPlayer()?.nativeElement;
    if (el) {
      el.currentTime = clamped;
    }
    this.service.setVideoCurrentTime(clamped);
  }

  seekRelative(delta: number): void {
    const current = this.service.videoCurrentTime();
    const newTime = Math.max(0, Math.min(this.totalDuration(), current + delta));
    this.seekTo(newTime);
  }

  onSeekSliderChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseFloat(input.value);
    this.seekTo(val);
  }

  isCaptionActive(cap: CaptionSegment): boolean {
    const time = this.service.videoCurrentTime();
    return time >= cap.startSeconds && time <= cap.endSeconds;
  }

  onCaptionTextChange(captionId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.service.updateCaptionSegment(captionId, { text: input.value });
  }

  adjustSegmentTime(cap: CaptionSegment, delta: number): void {
    const newStart = Math.max(0, Number((cap.startSeconds + delta).toFixed(2)));
    const duration = Math.max(1.0, cap.endSeconds - cap.startSeconds);
    const newEnd = Number((newStart + duration).toFixed(2));

    this.service.updateCaptionSegment(cap.id, {
      startSeconds: newStart,
      startTime: this.formatSecondsWithMs(newStart),
      endSeconds: newEnd,
      endTime: this.formatSecondsWithMs(newEnd),
    });
  }

  onScriptInputChange(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.customScriptText.set(el.value);
  }

  onSeparateFromScript(): void {
    const script = this.customScriptText().trim();
    if (!script) return;
    this.service.separateCaptions({
      rawText: script,
      durationSeconds: this.totalDuration(),
    });
  }

  onTriggerCaptionSeparation(): void {
    this.service.separateCaptionsForFile();
  }

  onRetryCaptionSeparation(): void {
    this.service.separateCaptionsForFile();
  }

  copyTranscript(text: string): void {
    navigator.clipboard.writeText(text);
    this.copiedTranscript.set(true);
    setTimeout(() => this.copiedTranscript.set(false), 2000);
  }

  formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  formatSecondsWithMs(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
