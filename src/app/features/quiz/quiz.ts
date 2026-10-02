import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-quiz',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Quiz</h1>`,
})
export class Quiz {}
