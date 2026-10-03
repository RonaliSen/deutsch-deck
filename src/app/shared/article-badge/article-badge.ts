import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Gender } from '../../core/models/word.model';

const GENDER_LABEL: Record<Gender, string> = {
  der: 'der (masculine)',
  die: 'die (feminine)',
  das: 'das (neuter)',
};

@Component({
  selector: 'app-article-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <span class="article-badge" [class]="'article-badge--' + gender()" [attr.aria-label]="label()" lang="de">{{ gender() }}</span> `,
  styleUrl: './article-badge.scss',
})
export class ArticleBadge {
  readonly gender = input.required<Gender>();

  protected readonly label = computed(() => GENDER_LABEL[this.gender()]);
}
