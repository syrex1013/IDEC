module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
    '^xterm$': '<rootDir>/src/test/__mocks__/xterm.js',
    '^xterm-addon-fit$': '<rootDir>/src/test/__mocks__/xterm-addon-fit.js'
  },
  testMatch: [
    '<rootDir>/src/**/*.test.{js,jsx}',
    '<rootDir>/src/**/*.spec.{js,jsx}'
  ],
  collectCoverageFrom: [
    'src/renderer/**/*.{js,jsx}',
    '!src/renderer/index.js',
    '!src/**/*.test.{js,jsx}',
    '!src/test/**'
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 43,
      lines: 43,
      statements: 43
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(framer-motion|lucide-react|@testing-library)/)'
  ],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/release/'],
  verbose: true
};
