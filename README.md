# Nedai - Studijų Pagalbininkas 💕

A beautiful study assistant desktop application - a birthday gift full of love!

## Features

- 📚 **PDF Upload & Processing** - Upload and analyze PDF documents
- 📝 **Structured Summary** - AI-generated summaries divided into sections
- 🧠 **Flashcards** - Interactive flashcard system with multiple choice and typed answers
- 💬 **Ask the Book** - Chat with your documents using AI
- 💖 **Birthday Greeting** - Special birthday message on first launch

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev
```

### Building for macOS

```bash
# Build macOS app packages (.dmg and .zip)
npm run electron:build:mac
```

### Building for Windows

```bash
# Build the Windows application
npm run electron:build:win
```

The built application will be in the `release` folder.

Note: Cross-building Windows installers from macOS may require additional tooling. If `electron:build:win` fails on macOS, run that command on a Windows machine.

## Configuration

1. Launch the application
2. Click on "Nustatymai" (Settings) in the sidebar
3. Enter your OpenAI API key
4. Start studying! 📖

## Tech Stack

- Electron
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- OpenAI API
- pdf-parse

---

Made with ❤️ as a birthday gift
# study-assistant
