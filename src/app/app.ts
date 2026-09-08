import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {Header} from './components/header';
import {IdeaGenerator} from './components/idea-generator';
import {ShootSchedule} from './components/shoot-schedule';
import {CaptionSeparator} from './components/caption-separator';
import {SocialDistributor} from './components/social-distributor';
import {SavedLibrary} from './components/saved-library';
import {ContentCreator} from './services/content-creator';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [Header, IdeaGenerator, ShootSchedule, CaptionSeparator, SocialDistributor, SavedLibrary],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly service = inject(ContentCreator);
}
