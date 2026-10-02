import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-words',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Words</h1>`,
})
export class Words {}
