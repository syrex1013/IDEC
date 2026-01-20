module.exports = {
  Terminal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    write: jest.fn(),
    writeln: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
    onData: jest.fn(),
    onResize: jest.fn(),
    loadAddon: jest.fn(),
    focus: jest.fn(),
    cols: 80,
    rows: 24
  }))
};
