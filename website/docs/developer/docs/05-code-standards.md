---
id: 05-code-standards
sidebar_position: 5
title: Code Standards
---

# Code Standards

Style rules, naming conventions, and coding practices.

## Style Rules

### Naming Conventions

**Handlers:**
```typescript
// Good
const handleLanguageChange = () => { ... }
const handleSave = () => { ... }

// Bad
const onLanguageChange = () => { ... }  // Use for props, not handlers
```

**Props callbacks:**
```typescript
// Good
interface Props {
  onLanguageChange: (lang: string) => void;
  onSave: () => void;
}

// Bad
interface Props {
  handleLanguageChange: (lang: string) => void;  // Use on* for props
}
```

**Boolean state:**
```typescript
// Good
const [isSaving, setIsSaving] = useState(false);
const [allowAnalytics, setAllowAnalytics] = useState(true);

// Bad
const [saving, setSaving] = useState(false);  // Less clear
```

**General:**
- Use descriptive names
- Follow existing patterns in the codebase
- When in doubt, mimic the code you see

### Error Handling Patterns

**Server (Express):**
```javascript
// Use try/catch for async operations
try {
  const result = await someAsyncOperation();
  res.json(result);
} catch (error) {
  logger.error('Operation failed', error);
  res.status(500).json({ error: error.message });
}
```

**Frontend (React):**
```typescript
// Handle errors in async operations
const handleAction = async () => {
  try {
    setIsLoading(true);
    await apiCall();
  } catch (error) {
    console.error('Action failed', error);
    // Show user-friendly error message
  } finally {
    setIsLoading(false);
  }
};
```

**Error boundaries:** Use React error boundaries for component-level error handling.

## Logging + Telemetry Conventions

### Server Logging (Winston)

**Location:** `apps/server/src/lib/logger.js`

**Current setup:**
- Console logging only (default)
- File logging: ⚠️ **Needs setup** - looking for help getting file logging configured!

**Guidelines:**
- **Reduce noise** - Don't log every operation
- Log errors and important events
- Use appropriate log levels:
  - `error` - Errors that need attention
  - `warn` - Warnings (non-fatal issues)
  - `info` - Important events (connection, disconnection)
  - `debug` - Detailed debugging (sparingly)

**Example:**
```javascript
const logger = require('./lib/logger');

logger.info('Server started on port 8000');
logger.error('Failed to connect to serial port', error);
logger.debug('G-code line sent', { line: 'G0 X10' });
```

### Frontend Logging

:::note Debug Mode
Enable debug mode by going to **Settings** and clicking "About" 10 times quickly. This creates an **Advanced Settings** section in Settings with a debug mode switch. When enabled, this:
- Shows a debug panel on the Setup and Monitor pages
- Enables additional logging for troubleshooting
- Provides detailed state information for development
:::

Browser console (F12) is also available for standard debugging.

**Production:**
- Minimize console logging
- Use error boundaries for error reporting
- Consider user-facing error messages instead of console logs

## Dependency Policy

### When to Add Dependencies

**Try not to add dependencies.** Prefer:
1. Native/built-in solutions
2. Existing dependencies in the repo
3. Small, focused libraries over large frameworks

**When it's OK:**
- Solves a real problem that can't be solved simply
- Well-maintained, widely used
- Small bundle size (for frontend)
- No security vulnerabilities

**Before adding:**
- Check if similar functionality exists in the codebase
- Consider if it's worth the maintenance burden
- For frontend: Check bundle size impact

### Dependency Management

**Workspace packages:**
- Add dependencies to the appropriate workspace `package.json`
- Not the root `package.json` (except dev tools used across workspaces)

**Example:**
```bash
# Add to web app
cd apps/web
yarn add new-package

# Add to server
cd apps/server
yarn add new-package
```

## Code Style

### Frontend (TypeScript/React)

- **TypeScript:** All new code should be TypeScript
- **Components:** Use functional components with hooks
- **Styling:** Tailwind CSS classes (prefer over custom CSS)
- **State:** Redux Toolkit for global state, `useState` for local state
- **API calls:** RTK Query (see `apps/web/src/services/api.ts`)

**Follow existing patterns:**
- Check similar files before creating new ones
- Use existing shadcn/ui components before creating new ones

### Backend (JavaScript)

- **ES6+ features:** Use modern JavaScript (async/await, destructuring, etc.)
- **Error handling:** Always handle errors, don't let them bubble uncaught
- **Logging:** Use Winston logger, not `console.log`

**Follow existing patterns:**
- Check similar API endpoints before creating new ones
- Use existing service patterns (ConfigStore, CNCEngine, etc.)

## Next Steps

- **[Testing Strategy](./06-testing-strategy.md)** - How to write and run tests
- **[Making Changes Safely](./07-making-changes-safely.md)** - Protected code and security
