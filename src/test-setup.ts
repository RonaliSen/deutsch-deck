// jsdom (the test environment) doesn't implement matchMedia. Real browsers
// always have it, but ThemeStore and Shell both call it directly, so tests
// need a stand-in.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
