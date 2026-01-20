module.exports = {
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: jest.fn(),
    proposeDimensions: jest.fn().mockReturnValue({ cols: 80, rows: 24 }),
    activate: jest.fn(),
    dispose: jest.fn()
  }))
};
