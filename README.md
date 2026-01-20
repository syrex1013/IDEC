<div align="center">

# IDEC

### Intelligent Development Environment with AI Code Assistance

A modern, feature-rich integrated development environment powered by AI, combining the flexibility of Monaco Editor with multi-provider AI capabilities.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/syrex1013/IDEC/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/syrex1013/IDEC)

[Features](#features) • [Installation](#installation) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Overview

IDEC is a next-generation integrated development environment that seamlessly integrates AI-powered coding assistance into your workflow. Built on modern web technologies, IDEC offers a responsive, intuitive interface with support for multiple AI providers including Claude, OpenAI, Groq, and local models via Ollama.

### Key Highlights

- **🤖 Multi-Provider AI Integration** – Switch seamlessly between Claude, OpenAI, Groq, and local Ollama models
- **📝 Professional Code Editor** – Powered by Monaco Editor with full syntax highlighting and IntelliSense
- **💻 Integrated Terminal** – Built-in terminal emulator for complete workflow integration
- **🎨 Modern UI/UX** – Minimalist design with smooth animations powered by Framer Motion
- **📁 Project Management** – Intuitive file explorer and workspace management
- **⚡ Cross-Platform** – Native builds for macOS, Windows, and Linux

---

## Features

### AI-Powered Development

IDEC provides four distinct AI interaction modes tailored for different development tasks:

| Mode | Description | Use Case |
|------|-------------|----------|
| 💬 **Chat** | Interactive conversation with AI | Ask questions, get suggestions, debug issues |
| 📖 **Explain** | Code analysis and documentation | Understand complex code, generate documentation |
| ♻️ **Refactor** | Code optimization and improvement | Enhance performance, improve readability |
| ✨ **Generate** | AI-assisted code generation | Create boilerplate, scaffold components |

### Development Tools

- **Monaco Editor** – The same powerful editor that powers Visual Studio Code
- **Terminal Emulation** – Full-featured terminal with xterm.js and node-pty
- **File System Integration** – Browse, edit, and manage project files
- **Syntax Highlighting** – Support for all major programming languages
- **Dark Theme** – Eye-friendly interface optimized for extended coding sessions

---

## Installation

### Prerequisites

Before installing IDEC, ensure you have the following:

- **Runtime**: [Bun](https://bun.sh) (recommended) or Node.js 18+
- **Optional**: [Ollama](https://ollama.ai) for local AI model support

### Quick Start

```bash
# Clone the repository
git clone https://github.com/syrex1013/IDEC.git
cd IDEC

# Install dependencies
bun install

# Start development server
bun start
```

### Building from Source

```bash
# Build production bundle
bun run build

# Run production build
bun run electron
```

### Creating Distributables

Build platform-specific installers and packages:

```bash
# Build for current platform
bun run dist

# Platform-specific builds
bun run dist:mac    # macOS (.dmg, .zip)
bun run dist:win    # Windows (.exe installer)
bun run dist:linux  # Linux (.AppImage, .deb)
```

---

## Configuration

### AI Provider Setup

IDEC supports multiple AI providers. Configure your preferred provider in Settings (⚙️):

#### Supported Providers

| Provider | API Key Format | Type | Setup Guide |
|----------|----------------|------|-------------|
| **Claude** | `sk-ant-...` | Cloud | [Get API Key →](https://console.anthropic.com) |
| **OpenAI** | `sk-...` | Cloud | [Get API Key →](https://platform.openai.com) |
| **Groq** | `gsk_...` | Cloud | [Get API Key →](https://console.groq.com) |
| **Ollama** | Not required | Local | [Install Ollama →](https://ollama.ai) |

### Local AI with Ollama

For privacy-focused development or offline work, use Ollama for local AI models:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download recommended models
ollama pull llama3.2      # General-purpose model
ollama pull codellama     # Optimized for code generation

# Configure IDEC
# 1. Open Settings in IDEC
# 2. Select "Ollama" as provider
# 3. Ensure Ollama is running: ollama serve
```

---

## Documentation

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save current file |
| `Cmd/Ctrl + O` | Open folder/project |
| `Cmd/Ctrl + N` | New file |
| `Cmd/Ctrl + W` | Close current file |

### Project Architecture

```
IDEC/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.js        # Application entry point
│   │   └── ipc/           # Inter-process communication
│   └── renderer/          # React frontend application
│       ├── components/    # Reusable UI components
│       ├── styles/        # Global styles and themes
│       ├── utils/         # Helper functions
│       └── App.js         # Root application component
├── public/                # Static assets and resources
├── dist/                  # Webpack build output
├── release/               # Platform-specific distributables
└── tests/                 # Test suites
```

### Technology Stack

IDEC is built with modern, industry-standard technologies:

- **Application Framework**: Electron 40
- **UI Library**: React 19
- **Animation**: Framer Motion
- **Code Editor**: Monaco Editor (VS Code engine)
- **Terminal**: xterm.js + node-pty
- **Icons**: Lucide React
- **Build Tools**: Webpack 5, electron-builder
- **Package Manager**: Bun

---

## Development

### Development Workflow

```bash
# Start development server with hot module replacement
bun start

# Build production bundle (no packaging)
bun run build

# Create packaged app without installer (for testing)
bun run pack

# Create full distribution with installer
bun run dist
```

### Testing

```bash
# Run test suite
bun run test

# Run tests in watch mode
bun run test:watch

# Generate coverage report
bun run test:coverage
```
Coverage reports are generated in the `coverage/` directory and can be viewed in your browser.

---

## Troubleshooting

### Common Issues

#### Ollama Connection Errors

**Problem**: Cannot connect to Ollama or models aren't responding

**Solution**:
```bash
# Ensure Ollama service is running
ollama serve

# Verify Ollama is accessible
curl http://localhost:11434/api/tags

# Check IDEC settings for correct URL (default: http://localhost:11434)
```

#### Build Failures

**Problem**: Build errors or dependency conflicts

**Solution**:
```bash
# Clear all caches and dependencies
rm -rf node_modules dist release bun.lockb

# Reinstall dependencies
bun install

# Rebuild application
bun run build
```

#### Application Won't Start

**Problem**: Electron app crashes on startup

**Solution**:
- Ensure you're using Node.js 18+ or latest Bun
- Check for conflicting global packages
- Review error logs in the terminal
- Try running in development mode: `bun start`

---

## Contributing

We welcome contributions to IDEC! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

IDEC is built with and inspired by:

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) by Microsoft
- [Electron](https://www.electronjs.org/) framework
- [xterm.js](https://xtermjs.org/) terminal emulator
- The open-source community

---

<div align="center">

**[Website](https://github.com/syrex1013/IDEC)** • **[Documentation](https://github.com/syrex1013/IDEC/wiki)** • **[Report Bug](https://github.com/syrex1013/IDEC/issues)** • **[Request Feature](https://github.com/syrex1013/IDEC/issues)**

Made with ❤️ by the IDEC team

</div>
