# Nerdearla Live Access

Open-source real-time multilingual accessibility and session documentation platform developed during the **Nerdearla Vibeathon 2026**.

Nerdearla Live Access transforms live speech into real-time transcription and translation while maintaining structured session history and supporting multiple independent live sessions.

## Live Demo

https://nerdearla-live-access.vercel.app

## Challenge

Live conferences need accessible multilingual communication with low latency, while production teams also need a way to preserve, monitor, and export what happened during each session.

Nerdearla Live Access addresses this through independent Gemini Live audio sessions that can transcribe, translate, retain session history, and operate concurrently.

## Core Features

### Conference Mode

A continuous conference workflow with:

- Real-time speech capture
- English to Spanish translation
- Spanish to English translation
- Original transcription and translated text
- Manual speaker labels
- Multiple session segments
- Pause and resume without losing session history
- Session lifecycle management
- Complete-session export

### Bilingual Conversation

A persistent turn-by-turn bilingual conversation:

- Speaker A: English -> Spanish
- Speaker B: Spanish -> English
- Repeated speaker switching
- Chronological conversation memory
- Original and translated text for every turn
- Independent closed segments
- Complete conversation export

### Concurrency Demo

A production-oriented demonstration of simultaneous session processing:

- Independent Stage A and Stage B
- Two simultaneous Gemini Live sessions
- Independent microphone/audio pipelines
- Independent timers and PCM chunk counters
- Independent transcript streams
- Start and stop each session separately
- Start Both / Stop Both controls
- One session can stop while the other continues

This demonstrates the session-worker pattern used to scale the architecture horizontally.

## Export

Conference and conversation sessions can be exported as:

- TXT
- SRT
- VTT

Available content modes include:

- Original
- Translation
- Bilingual

The export engine also supports segment filtering programmatically.

## Technical Glossary

A deterministic normalization layer is included for selected technical and event-specific terminology, including:

- Nerdearla
- Vibeathon
- Gemini
- Devpost
- OBS
- vMix

This layer helps normalize known recognition variants without modifying the underlying audio stream.

## Architecture

```text
Microphone
    |
    v
Browser Audio Pipeline
PCM 16-bit / mono / 16 kHz
    |
    v
Gemini Live Session
    |
    +---- Original transcription
    |
    +---- Live translation
    |
    v
Session Memory
    |
    +---- Conference Mode
    +---- Conversation Mode
    +---- Operations / Concurrency
    |
    v
TXT / SRT / VTT Export
```

Each live stage owns an isolated session, audio pipeline, state, timer, and transcript stream.

The concurrency model is designed around independent session workers. Additional sessions can be distributed horizontally across application instances or workers rather than sharing one global transcription state.

## Gemini Live Integration

The application uses Gemini Live for real-time audio processing.

The browser captures microphone audio and sends PCM audio to an independent Live session.

Production authentication uses short-lived ephemeral tokens:

```text
Browser
   |
   | POST /api/translate-token
   v
Next.js server route
   |
   | GEMINI_API_KEY
   v
Gemini AuthTokenService
   |
   | short-lived token
   v
Browser -> Gemini Live
```

The permanent Gemini API key remains server-side and is not exposed to the browser.

## Session Model

The application uses a structured in-memory session model:

```text
Session
  id
  mode
  title
  startedAt
  endedAt
  segments[]
    id
    speaker
    sourceLanguage
    targetLanguage
    startedAt
    endedAt
    originalText
    translatedText
```

This allows pause/resume and speaker switching without destroying the current session history.

## Tech Stack

- Next.js 16
- React
- TypeScript
- Google GenAI SDK
- Gemini Live
- Web Audio API
- AudioWorklet
- PCM 16 kHz audio pipeline
- Vercel
- GitHub

## Local Setup

Requirements:

- Node.js 22+
- npm
- A Gemini API key

Clone the repository:

```bash
git clone https://github.com/angeladrianpagnini-star/NERDEARLA-LIVE-ACCESS.git
cd NERDEARLA-LIVE-ACCESS/frontend
npm install
```

Create:

```text
frontend/.env.local
```

Add:

```text
GEMINI_API_KEY=your_key_here
```

Never commit `.env.local` or expose the API key in client-side code.

Run development mode:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Quality Gate

Before production deployment:

```bash
npm run lint
npm run build
```

The current production checkpoint passes both ESLint and the Next.js production build.

## Production Validation

The public deployment has been validated with:

- Conference Mode: English -> Spanish
- Persistent conference segments
- Bilingual Conversation: EN -> ES and ES -> EN
- Three-turn chronological conversation history
- Two concurrent live sessions
- Independent session shutdown
- Continued streaming on one stage while the other stops
- Session export interface
- Clean session lifecycle after capture stops

## Scalability

The prototype demonstrates concurrency with two simultaneous independent Gemini Live sessions.

The architecture does not depend on a single shared transcription process. Each live session has isolated state and can be mapped to its own worker or application instance.

A production deployment can extend this pattern with:

- Horizontal worker replication
- Session routing
- Shared persistent storage
- Authentication and organization boundaries
- Centralized metrics and observability
- Usage and cost controls

## Current Prototype Limitations

This Vibeathon prototype intentionally focuses on the challenge requirements.

Current limitations:

- Session memory is stored in the browser application state and is lost after a page refresh.
- Speaker labels are manual; automatic diarization is not implemented.
- The technical glossary uses deterministic normalization rather than a dynamic vocabulary service.
- The current production demo focuses on microphone input.
- Speech-recognition accuracy can vary with pronunciation, background audio, and technical terminology.
- The export UI currently exports the complete session; segment-selective export is supported by the export engine but is not exposed in the interface.

## Security

- Permanent Gemini API credentials remain server-side.
- Browser Live connections use short-lived ephemeral credentials.
- `.env.local` is excluded from Git.
- Audio is streamed for live processing; the prototype does not implement persistent server-side audio storage.
- Live sessions are explicitly closed when capture ends or the user leaves an active workflow.

## Hackathon Development

Development began on **September 24, 2026**, during the official Nerdearla Vibeathon 2026 development period.

The project was built specifically for the challenge and uses existing public libraries, APIs, models, and platform services.

## Repository

https://github.com/angeladrianpagnini-star/NERDEARLA-LIVE-ACCESS

## License

MIT