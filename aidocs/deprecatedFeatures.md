# Deprecated Features

This document tracks features that were present in the original CNCjs codebase but have been intentionally left behind or temporarily removed in the AxioCNC modernization effort.

## Multi-User Support

**Status:** Temporarily Removed

**Original Implementation:**
- User authentication and authorization system
- Multiple user accounts with password protection
- User role management (admin, user, etc.)
- Session management with JWT tokens
- User-specific settings and configurations

**Current Status:**
- Multi-user support has been removed from the initial modernization
- The application currently operates in a single-user mode
- Authentication is simplified (token-based, optional authentication)
- Settings are stored per-instance rather than per-user

**Rationale:**
- Simplifies initial development and reduces complexity
- Most CNC setups are single-user environments
- Can be reintroduced later if multi-user support is needed
- Focus on core CNC functionality first

**Future Consideration:**
Multi-user support may be reintroduced in a future version if there's a need for:
- Shared machine access
- User-specific configurations
- Access control and permissions
- Audit logging per user

## Commands Panel

**Status:** Removed

**Original Implementation:**
- Custom command buttons in the Setup dashboard
- Quick shortcuts for common G-code commands
- Configurable command panel with named buttons
- Commands defined in Settings

**Current Status:**
- Commands panel has been removed from the Setup dashboard
- Commands section has been removed from Settings
- Command management API endpoints remain in backend (for potential future use)

**Rationale:**
- Macros provide more powerful and flexible functionality
- Reduces UI complexity and cognitive load
- Most "command" use cases can be handled via:
  - Macros (for multi-line or complex sequences)
  - Direct G-code input in the Console panel
  - Quick actions in the machine control panels (Home, Reset, etc.)

**Alternative Solutions:**
- Use **Macros** for saved command sequences
- Use **Console** panel for one-off G-code commands
- Use **Machine Control** buttons (Home, Reset, Unlock, etc.) for common operations

## Notes

These features were not removed due to bugs or problems, but rather to:
1. Simplify the codebase for modernization
2. Focus development effort on core functionality
3. Reduce maintenance burden
4. Improve user experience by removing redundant features

All removed features can be reintroduced if there's sufficient user demand or use case justification.
