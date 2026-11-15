import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * The gradient page header (same look as the Home greeting): eyebrow pill,
 * h1, then projected body content. Anything marked `bannerArt` is projected
 * into a decorative, aria-hidden slot on the right, shown only when the
 * nearest query container is at least 560px wide.
 */
@Component({
  selector: 'app-page-banner',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="banner" [attr.aria-labelledby]="headingId()">
      <div class="banner-text">
        <p class="eyebrow">
          <mat-icon>{{ eyebrowIcon() }}</mat-icon
          >{{ eyebrow() }}
        </p>
        <h1 [id]="headingId()">{{ heading() }}</h1>
        <ng-content />
      </div>
      <div class="banner-art" aria-hidden="true">
        <ng-content select="[bannerArt]" />
      </div>
    </section>
  `,
  styleUrl: './page-banner.scss',
})
export class PageBanner {
  readonly heading = input.required<string>();
  /** Id for the h1, which also labels the section landmark. */
  readonly headingId = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly eyebrowIcon = input.required<string>();
}
