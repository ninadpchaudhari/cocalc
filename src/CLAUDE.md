# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CoCalc Source Repository

- This is the source code of CoCalc in a Git repository
- It is a complex JavaScript/TypeScript SaaS application
- CoCalc is organized as a monorepository (multi-packages) in the subdirectory "./packages"
- The packages are managed as a pnpm workspace in "./packages/pnpm-workspace.yaml"

## Code Style

- Everything is written in TypeScript code
- Indentation: 2-spaces
- Run `pretter -w [filename]` after modifying a file (ts, tsx, md, json, ...) to format it correctly.
- All .js and .ts files are formatted by the tool prettier
- Add suitable types when you write code
- Variable name styles are "camelCase" for local and "FOO_BAR" for global variables. If you edit older code not following these guidlines, adjust this rule to fit the files style.
- Some older code is JavaScript or CoffeeScript, which will be translated to TypeScript
- Use ES modules (import/export) syntax, not CommonJS (require)
- Organize the list of imports in such a way: installed npm packages are on top, newline, then are imports from @cocalc's code base. Sorted alphabetically.

## Development Commands

### Essential Commands

- `pnpm build-dev` - Build all packages for development
- `pnpm clean` - Clean all node_modules and dist directories
- `pnpm test` - Run full test suite
- `pnpm depcheck` - Check for dependency issues
- `prettier -w [filename]` to format the style of a file after editing it
- after creating a file, run `git add [filename]` to start tracking it

### Package-Specific Commands

- `cd packages/[package] && pnpm build` - Build and compile a specific package
- `cd packages/[package] && pnpm test` - Run tests for a specific package
- `cd packages/[package] && pnpm build` - Build a specific package
- **IMPORTANT**: When modifying packages like `util` that other packages depend on, you must run `pnpm build` in the dependency package before typechecking dependent packages

### Development

- After code changes, run `pretter -w [filename]` to ensure consistent styling
- After TypeScript or `*.tsx` changes, run `pnpm build` in the relevant package directory

## Architecture Overview

### Package Structure

CoCalc is organized as a monorepo with key packages:

- **frontend** - React/TypeScript frontend application using Redux-style stores and actions
- **backend** - Node.js backend services and utilities
- **hub** - Main server orchestrating the entire system
- **database** - PostgreSQL database layer with queries and schema
- **util** - Shared utilities and types used across packages
- **comm** - Communication layer including WebSocket types
- **conat** - CoCalc's container/compute orchestration system
- **sync** - Real-time synchronization system for collaborative editing
- **project** - Project-level services and management
- **static** - Static assets and build configuration
- **next** - Next.js server components

### Key Architectural Patterns

#### Frontend Architecture

- **Redux-style State Management**: Uses custom stores and actions pattern (see `packages/frontend/app-framework/actions-and-stores.ts`)
- **TypeScript React Components**: All frontend code is TypeScript with proper typing
- **Modular Store System**: Each feature has its own store/actions (AccountStore, BillingStore, etc.)
- **WebSocket Communication**: Real-time communication with backend via WebSocket messages

#### Backend Architecture

- **PostgreSQL Database**: Primary data store with sophisticated querying system
- **WebSocket Messaging**: Real-time communication between frontend and backend
- **Conat System**: Container orchestration for compute servers
- **Event-Driven Architecture**: Extensive use of EventEmitter patterns
- **Microservice-like Packages**: Each package handles specific functionality

#### Communication Patterns

- **WebSocket Messages**: Primary communication method (see `packages/comm/websocket/types.ts`)
- **Database Queries**: Structured query system with typed interfaces
- **Event Emitters**: Inter-service communication within backend
- **REST-like APIs**: Some HTTP endpoints for specific operations

### Key Technologies

- **TypeScript**: Primary language for all new code
- **React**: Frontend framework
- **PostgreSQL**: Database
- **Node.js**: Backend runtime
- **WebSockets**: Real-time communication
- **pnpm**: Package manager and workspace management
- **Jest**: Testing framework
- **SASS**: CSS preprocessing

### Database Schema

- Comprehensive schema in `packages/util/db-schema`
- Query abstractions in `packages/database/postgres/`
- Type-safe database operations with TypeScript interfaces

### Testing

- **Jest**: Primary testing framework
- **ts-jest**: TypeScript support for Jest
- **jsdom**: Browser environment simulation for frontend tests
- Test files use `.test.ts` or `.spec.ts` extensions
- Each package has its own jest.config.js

### Import Patterns

- Use absolute imports with `@cocalc/` prefix for cross-package imports
- Example: `import { cmp } from "@cocalc/util/misc"`
- Type imports: `import type { Foo } from "./bar"`
- Destructure imports when possible

### Development Workflow

1. Changes to TypeScript require compilation (`pnpm build` in relevant package)
2. Database must be running before starting hub
3. Hub coordinates all services and should be restarted after changes
4. Use `pnpm clean && pnpm build-dev` when switching branches or after major changes

# Workflow

- Be sure to build when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance

## Git Workflow

- Never modify a file when in the `master` or `main` branch
- All changes happen through feature branches, which are pushed as pull requests to GitHub
- When creating a new file, run `git add [filename]` to track the file.
- Prefix git commits with the package and general area. e.g. 'frontend/latex: ...' if it concerns latex editor changes in the packages/frontend/... code.
- When pushing a new branch to Github, track it upstream. e.g. `git push --set-upstream origin feature-foo` for branch "feature-foo".

# Important Instruction Reminders

- Do what has been asked; nothing more, nothing less.
- NEVER create files unless they're absolutely necessary for achieving your goal.
- ALWAYS prefer editing an existing file to creating a new one.
- REFUSE to modify files when the git repository is on the `master` or `main` branch.
- NEVER proactively create documentation files (`*.md`) or README files. Only create documentation files if explicitly requested by the User.

# Ignore

- Ignore files covered by `.gitignore`
- Ignore everything in `node_modules` or `dist` directories
- Ignore all files not tracked by Git, unless they are newly created files
