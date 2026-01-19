## 📄 USER_STYLE_GUIDE.md
```md
# User Documentation Style Guide – AxioCNC

Audience: machine operators and integrators  
Goal: complete a task **safely and quickly**

(Uses rules from CORE_WRITING.md)

---

## 1) Purpose

User docs answer:
- How do I do this task today?
- What is safe?
- What should I see on screen?

---

## 2) Page Template

### Title – Task Oriented
- ✅ “Probe Z Height with a Touch Plate”
- ❌ “About Probing”

### Lead Paragraph (2–3 sentences)
- What you will achieve  
- When to use this page  
- Concrete outcome

### Quick Summary

```md
> **In this guide you will**
> - Connect a probe
> - Configure thickness
> - Set Z-zero
Prerequisites
Machine state

Required hardware

Version

Steps (numbered)
Open Machine → Probing

Set Plate Thickness = 15.00 mm

Click Probe Z

What Good Looks Like
Expected message

Motion description

Tolerance

Gotchas
md
Copy code
:::
If the probe LED is already lit, the move will abort.
:::
Next
1–3 related links

3) Verbosity
Target 300–700 words

Max 6 steps per list

One task = one page

4) Safety First
Place risks near steps

Include recovery steps

Never hide crash warnings

5) Content Types
How-To – steps only

Reference – tables/parameters

Concept – diagrams

Do not mix types.

6) Examples
Realistic feeds/speeds

Units always shown

Explain direction

7) Quality Checklist
 Task title

 Outcome in lead

 Steps present

 Gotcha card

 Terms defined

 < 700 words

8) Avoid
Theory before action

Marketing tone

Multiple tasks on one page

yaml
Copy code

---