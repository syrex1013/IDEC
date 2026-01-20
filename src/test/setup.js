require('@testing-library/jest-dom');

// Create a shared mock that can be controlled by tests
const mockInvoke = jest.fn().mockResolvedValue({ success: true });
const mockOn = jest.fn();
const mockRemoveListener = jest.fn();
const mockOpenExternal = jest.fn();

const mockElectronModule = {
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener
  },
  shell: {
    openExternal: mockOpenExternal
  }
};

// Make mock accessible for tests
global.__mockElectron = mockElectronModule;
global.__mockInvoke = mockInvoke;
global.__mockOpenExternal = mockOpenExternal;

// Mock electron
jest.mock('electron', () => mockElectronModule, { virtual: true });

// Mock window.require for electron
Object.defineProperty(window, 'require', {
  writable: true,
  value: (module) => {
    if (module === 'electron') {
      return mockElectronModule;
    }
    throw new Error(`Cannot find module '${module}'`);
  }
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue('')
  }
});

// Mock confirm dialog
window.confirm = jest.fn(() => true);

// Mock xterm.js
const mockTerminal = {
  options: {},
  open: jest.fn(),
  write: jest.fn(),
  writeln: jest.fn(),
  clear: jest.fn(),
  reset: jest.fn(),
  dispose: jest.fn(),
  onData: jest.fn(() => ({ dispose: jest.fn() })),
  onResize: jest.fn(() => ({ dispose: jest.fn() })),
  loadAddon: jest.fn(),
  focus: jest.fn(),
  blur: jest.fn(),
  cols: 80,
  rows: 24,
  element: document.createElement('div')
};

jest.mock('xterm', () => ({
  Terminal: jest.fn(() => mockTerminal)
}), { virtual: true });

jest.mock('xterm-addon-fit', () => ({
  FitAddon: jest.fn(() => ({
    fit: jest.fn(),
    proposeDimensions: jest.fn(() => ({ cols: 80, rows: 24 })),
    dispose: jest.fn()
  }))
}), { virtual: true });

jest.mock('xterm-addon-web-links', () => ({
  WebLinksAddon: jest.fn(() => ({
    dispose: jest.fn()
  }))
}), { virtual: true });

global.__mockXterm = mockTerminal;
