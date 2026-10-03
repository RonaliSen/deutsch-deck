// jsdom doesn't implement IndexedDB at all. Dexie checks for it at module
// load time, so this has to run before any spec file imports Dexie
// (directly or via DeutschDeckDb) - several already do, and the test
// harness shares one module registry across spec files, so a per-spec-file
// import here would run too late if another file's imports got there first.
import 'fake-indexeddb/auto';

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
