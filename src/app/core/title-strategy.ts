import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Routes set a short `title` (e.g. 'Study'); this appends " · DeutschDeck"
 * once, centrally, instead of repeating the suffix in every route. A route
 * with no title (Home) gets the bare app name rather than "Home · DeutschDeck".
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    this.title.setTitle(routeTitle ? `${routeTitle} · DeutschDeck` : 'DeutschDeck');
  }
}
