import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-study',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Study</h1>`,
})
export class Study {}
