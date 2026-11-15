import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Word } from '../../../core/models/word.model';
import { WordDialog } from './word-dialog';

// The first test in this file pays the one-off cost of setting up the
// Material form-field/chip/toggle/autocomplete components - ~2s alone, but
// it can pass Vitest's 5s default when the whole suite runs in parallel on
// a slow machine. The extra allowance only matters for that cold start.
describe('WordDialog', { timeout: 15_000 }, () => {
  let fixture: ComponentFixture<WordDialog>;
  let el: HTMLElement;
  let close: ReturnType<typeof vi.fn>;

  function setup(word?: Word): void {
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: word ? { word } : null },
      ],
    });
    fixture = TestBed.createComponent(WordDialog);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  function type(label: string, value: string): void {
    const field = Array.from(el.querySelectorAll('mat-form-field')).find((f) =>
      f.querySelector('mat-label')!.textContent!.includes(label),
    )!;
    const input = field.querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function toggle(groupLabelId: string, label: string): void {
    const group = el.querySelector(`[aria-labelledby="${groupLabelId}"]`)!;
    const button = Array.from(group.querySelectorAll('button')).find(
      (b) => b.textContent!.trim() === label,
    )!;
    button.click();
    fixture.detectChanges();
  }

  const submit = () => {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
  };
  const text = () => el.textContent!.replace(/\s+/g, ' ');

  it('shows Add word with no article and level A1 preselected', () => {
    setup();

    expect(el.querySelector('h2')!.textContent).toContain('Add word');
    const checked = Array.from(
      el.querySelectorAll('[aria-checked="true"], [aria-pressed="true"]'),
    ).map((b) => b.textContent!.trim());
    expect(checked).toEqual(['None', 'A1']);
  });

  it('shows every required-field error and does not close when saved empty', () => {
    setup();
    submit();

    expect(text()).toContain('German word is required');
    expect(text()).toContain('English meaning is required');
    expect(text()).toContain('Topic is required');
    expect(close).not.toHaveBeenCalled();
  });

  it('rejects a topic that is not in the list', () => {
    setup();
    type('Topic', 'space');
    submit();

    expect(text()).toContain('Choose a topic from the list');
  });

  it('saves trimmed values, picked article and level, and a lowercased topic', () => {
    setup();
    toggle('word-article-label', 'das');
    toggle('word-level-label', 'B1');
    type('German', '  Fenster ');
    type('Plural', ' Fenster ');
    type('English', ' window ');
    type('Topic', 'Home');
    submit();

    expect(close).toHaveBeenCalledWith({
      german: 'Fenster',
      english: 'window',
      level: 'B1',
      topic: 'home',
      gender: 'das',
      plural: 'Fenster',
    });
  });

  it('leaves out article and plural when they are empty', () => {
    setup();
    type('German', 'laufen');
    type('English', 'to run');
    type('Topic', 'other');
    submit();

    expect(close).toHaveBeenCalledWith({
      german: 'laufen',
      english: 'to run',
      level: 'A1',
      topic: 'other',
    });
  });

  it('prefills everything when editing', async () => {
    setup({
      id: 1,
      german: 'Tisch',
      english: 'table',
      gender: 'der',
      plural: 'Tische',
      level: 'A2',
      topic: 'home',
      box: 3,
      dueAt: 0,
      createdAt: 0,
    });

    // The topic input's autocomplete writes its initial value a microtask late.
    await fixture.whenStable();

    expect(el.querySelector('h2')!.textContent).toContain('Edit word');
    const values = Array.from(el.querySelectorAll('input')).map((i) => i.value);
    expect(values).toEqual(['Tisch', 'Tische', 'table', 'home']);
    const checked = Array.from(
      el.querySelectorAll('[aria-checked="true"], [aria-pressed="true"]'),
    ).map((b) => b.textContent!.trim());
    expect(checked).toEqual(['der', 'A2']);
  });

  it('Cancel closes without a result', () => {
    setup();
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent!.trim() === 'Cancel')!
      .click();

    expect(close).toHaveBeenCalledWith();
  });
});
