## 📄 DEV_STYLE_GUIDE.md
```md
# Developer Documentation Style Guide – AxioCNC

Audience: contributors, integrators, maintainers  
Goal: go from clone → meaningful PR in one session

(Uses rules from CORE_WRITING.md)

---

## 1) Purpose

Developer docs explain:
- Architecture and rationale  
- How to modify safely  
- Branch/PR workflow  
- Build & release pipeline

---

## 2) Required Sections

Every topic must include:

```md
## What you’ll learn
## When to read this
Flow Order
Mental model

Where code lives

How to change

How to test

How to PR

3) Mandatory Canonical Pages
Getting Started (clone → run → debug)

Repo Layout

Build & Bundle Contract

Branch Strategy

PR Expectations

Testing Strategy

Release Process

API Philosophy

4) Code Practices
Show real paths:

apps/server/src/probing/ProbeService.ts

Explain why boundaries exist

Include small snippets and Mermaid diagrams

5) Branch & PR
Reference on every change guide:

Trunk-based main

Tags vX.Y.Z drive releases

PR checklist

md
Copy code
### PR Requirements
- tests added
- bundle verified
- changelog entry
6) API Docs
For public APIs include:

intent

parameters

side effects

examples

stability level

7) Architecture Template
md
Copy code
# <Subsystem>

## Responsibilities
## Boundaries
## Data Flow
## Extension Points
## Common Changes
## Gotchas
8) Verbosity
500–1200 words per concept

Diagrams encouraged

9) Diagrams to Maintain
Build pipeline

Runtime flow

Electron bootstrap

Serial I/O path

10) Anti-Patterns
UI click instructions

Hiding rationales

Copying user docs

11) Quality Checklist
 Explains why

 Links to code paths

 Shows how to test

 References branch/PR

 Includes diagram/snippet

yaml
Copy code

---