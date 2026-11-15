import { isInteractiveTarget } from './keyboard';

describe('isInteractiveTarget', () => {
  function el(html: string, selector: string): Element {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.querySelector(selector)!;
  }

  it('is true for buttons, links, options and form fields', () => {
    expect(isInteractiveTarget(el('<button>x</button>', 'button'))).toBe(true);
    expect(isInteractiveTarget(el('<a href="/">x</a>', 'a'))).toBe(true);
    expect(isInteractiveTarget(el('<div role="option">x</div>', 'div'))).toBe(true);
    expect(isInteractiveTarget(el('<input />', 'input'))).toBe(true);
  });

  it('is true for an element inside a button (e.g. its icon)', () => {
    expect(isInteractiveTarget(el('<button><span>icon</span></button>', 'span'))).toBe(true);
  });

  it('is false for plain content, the body, and no target', () => {
    expect(isInteractiveTarget(el('<p>text</p>', 'p'))).toBe(false);
    expect(isInteractiveTarget(el('<a>no href</a>', 'a'))).toBe(false);
    expect(isInteractiveTarget(document.body)).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });
});
