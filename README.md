# IDEC - AI-Powered IDE

A modern, minimalist IDE with integrated AI assistance. Built with Electron, React, and Monaco Editor.

![IDEC](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

## Features

- 🤖 **Multi-Provider AI** - Claude, OpenAI, Groq, and Ollama support
- 📝 **Monaco Editor** - VS Code's powerful editor with syntax highlighting
- 🎨 **Modern Dark Theme** - Cursor-inspired minimalist design
- ⚡ **Framer Motion** - Smooth, professional UI animations
- �� **Integrated Terminal** - Full terminal emulator with xterm.js
- 📁 **File Explorer** - Navigate and manage your project files
- 🔧 **AI Modes** - Chat, Explain, Refactor, and Generate code

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- [Ollama](https://ollama.ai) (optional, for local AI models)

### Installation

```bash
# Clone the repository
git clone https://github.com/adrian/idec.git
cd idec

# Install dependencies
bun install

# Run in development mode (with hot reload)
bun start

# Or build and run production
bun run build && bun run electron
```

### Building Distributable

```bash
# Build for current platform
bun run dist

# Platform-specific builds
bun run dist:mac    # macOS (.dmg, .zip)
bun run dist:win    # Windows (.exe)
bun run dist:linux  # Linux (.AppImage, .deb)
```

## Configuration

### AI Providers

Open Settings (⚙️) to configure your AI providers:

| Provider | API Key | Local | Get Key |
|----------|---------|-------|---------|
| Claude | `sk-ant-...` | No | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | `sk-...` | No | [platform.openai.com](https://platform.openai.com) |
| Groq | `gsk_...` | No | [console.groq.com](https://console.groq.com) |
| Ollama | Not required | Yes | [ollama.ai](https://ollama.ai) |

### Ollama Setup (Local AI)

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull a model
ollama pull llama3.2
ollama pull codellama  # For coding tasks

# 3. Select "Ollama" in IDEC settings
```

## AI Features

| Mode | Description |
|------|-------------|
| 💬 **Chat** | Ask questions about your code or get help |
| 📖 **Explain** | Get detailed explanations of selected code |
| ♻️ **Refactor** | Improve and optimize your code |
| ✨ **Generate** | Create new code from descriptions |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save file |
| `Cmd/Ctrl + O` | Open folder |

## Project Structure

```
idec/
├── src/
│   ├── main/           # Electron main process
│   │   └── main.js     # IPC handlers, window management
│   └── renderer/       # React frontend
│       ├── components/ # UI components
│       ├── styles/     # CSS with CSS variables
│       └── App.js      # Main application
├── public/             # Static assets
├── dist/               # Webpack build output
└── release/            # Packaged applications
```

## Tech Stack

- **Framework**: Electron 40
- **Frontend**: React 19, Framer Motion
- **Editor**: Monaco Editor
- **Terminal**: xterm.js + node-pty
- **Icons**: Lucide React
- **Build**: Webpack 5, electron-builder

## Development

```bash
# Development with hot reload
bun start

# Build production bundle only
bun run build

# Package app without installer (for testing)
bun run pack

# Full distribution build
bun run dist
```

## Troubleshooting

### Ollama Connection Issues
- Ensure Ollama is running: `ollama serve`
- Check the URL in settings (default: `http://localhost:11434`)

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install
```

## License

MIT © Adrian

---

<p align="center">
  <b>IDEC</b> - Intelligent Development Environment with Code AI
</p>

## Testing

```bash
# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

Coverage reports are generated in the `coverage/` directory.
