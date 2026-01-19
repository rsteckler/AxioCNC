# Core Writing Standards – AxioCNC

These rules apply to **all documentation** (user and developer).

---

## 1) Universal Voice

- Direct, factual, respectful  
- Active voice, second person (“you”)  
- No marketing language  
- Short sentences (≤ 22 words)

### Preferred
- “Set probe thickness to 15 mm.”
- “Restart the controller.”

### Avoid
- “This revolutionary system allows you to…”
- “Simply / obviously / easy”

---

## 2) Accessibility

- Headings every 3–5 paragraphs  
- Alt text for images  
- Don’t rely on color alone  
- State units (mm vs inch)

---

## 3) Admonitions (Docusaurus)

Use consistently:

- `:::tip` – faster workflow  
- `:::note` – context  
- `:::warning` – common mistakes  
- `:::danger` – crash/electrical risk

---

## 4) Terminology Rules

- Define CNC-specific terms on first use  
- Use one canonical term per concept

**Canonical Terms**
- Probing  
- Work Offset (G54)  
- Machine Coordinates  
- Touch Plate  
- Tool Length Offset  
- Feed / Rapid  
- Homing

Do **not** mix: “part zero / job zero / origin” → always **Work Offset**.

---

## 5) Code & Commands

- Show real values, not placeholders  
- Include units  
- Comment intent

```gcode
G38.2 Z-10 F50  ; probe downward 10mm at 50 mm/min
6) Images & Examples
Show before → after

Describe what to click or observe

Avoid screenshots without explanation

7) Page Quality Checklist
 Clear title

 Outcome stated early

 Steps or structure visible

 At least one admonition

 Terms defined

 Links to next steps

8) Anti-Patterns
Walls of text

Mixed audiences on one page

Jargon without definition

Marketing adjectives

yaml
Copy code

---