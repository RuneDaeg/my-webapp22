<!-- 한국어 원문: 만든-방법과-철학.md -->
*Read in [한국어](만든-방법과-철학.md).*

# How I Built the Assignment Grading Assistant — Method and Philosophy

> On grading students' work together with AI, and the things I wanted to protect along the way.
> — A development journal by a teacher who teaches physics

This document is a record of the ideas the [Assignment Grading Assistant](../README.md) was built on, and
of how a teacher who cannot write code himself saw this tool through to completion. It is not a feature
manual, but a story about decisions and the reasons behind them. (For how to use the app, see the
[User Guide](사용설명서.md).)

---

## Opening — Why I built it

In a teacher's day, grading, feedback, and writing school records take the most time, yet none of it is time
spent face to face with a student. Teaching physics, I always felt that imbalance keenly. If I could shave off
a little of the grading drudgery, couldn't I give that time back to each student, one by one?

As it happens, generative AI is fairly good at reading text, judging it against criteria, and drafting. But
bringing that straight into the classroom was a different matter. Scores, feedback, and the "subject-specific
abilities and special notes" (세특) become part of a student's permanent record. I could not let AI decide
them. So the very first thing I fixed, before building anything, was a single line: **"AI writes the draft;
the teacher makes the judgment."**

---

## One · Principles — What I held to while building

Every time I added a feature, I asked myself: is this the right choice in a classroom? The following six
became the standards that did not bend.

**Principle 01 — AI writes the draft; the teacher makes the judgment.**
The score, the student feedback, and the 세특 draft are all produced by AI, but none of it reaches the student
as-is. It is published only after the teacher reviews and revises it. The 세특 draft and the grading rationale
are never shown to students at all. AI is an assistant, not the decision-maker.

**Principle 02 — Don't hand over the answer; help them get there themselves.**
Quiz feedback never states the correct answer. When a student is wrong, it explains the relevant concept,
serves another question on the same concept, and gathers the concepts that need review in one place. The goal
is not answer-checking but the student's growth.

**Principle 03 — Move the classroom's rules directly into the code.**
The 세특 draft follows school-record regulations — no formulas, no English, and so on. All times are shown in
Korea Standard Time, and classes are grouped by a join code. The tool must know the grammar of the field
first.

**Principle 04 — Protect student data without compromise.**
A student must not be able to see a question's answer — not on screen, and not in the data. I blocked anyone
from freely creating teacher or admin accounts, and I never placed real school files in a publicly served
folder. Before going public, I attempted an intrusion myself and closed the hole through which a student could
have peeked at answers.

**Principle 05 — Everyone owns their own.**
I made it so each school can copy the app onto its own server, and each teacher plugs in their own AI key —
so that everyone doesn't hang on a single person's one key. I encrypted even that key, so that even looking
through the entire database reveals nothing of the original.

**Principle 06 — Ship fast, then fix by actually using it.**
I didn't cling to it until it was perfect. When I changed something I deployed right away, and tested with
real physics exam papers and real submissions. The most important bugs revealed themselves not at the desk,
but in use.

> **"Is this feature the right choice in a classroom?"** — the single question I placed before every decision.

---

## Two · Method — How to finish it even when you can't code

I am not a developer. That I could still complete this tool comes down to drawing a clear line between the
work I took on and the work I handed off.

### The "what" and the "why" were mine to decide

I did not write the code myself. Instead I described what was needed in plain words. "When a student presses
the same join code twice, they get counted as two people." "The feedback must not change every time the page
is refreshed." "I want each teacher to plug in their own API." — like that. The implementation was the AI
coding partner's job; I steered by actually clicking through what got built. **Deciding what to build, why to
build it, and whether it was good as-is** was my part.

### I chose the tech for "one person, end to end — and copyable by others"

A web framework that handles the screen and the server as one body (Next.js); a service that solves login,
database, and file storage in one place (Supabase); and generative AI that reads and judges documents. The
reason for this combination is simple: one person can build it from start to finish, and another school can
copy it wholesale and stand it up as their own. For PDFs, rather than extracting only text, I send the
original whole — tables, figures, and photos included — to the AI so they factor into grading.

### Bugs showed up in use, and I fixed them on the spot

There were things I would never have known without actually using it. A submission that stalled on "grading"
until it timed out; a question just answered correctly reappearing, or conversely a unit ending far too early;
a name rendering as a blank space. Every one surfaced not in a blueprint on the desk but in classroom use.
Each time, I reported the symptom as it was, found the cause, fixed it, and deployed again.

### I verified security by "testing," not by "claiming"

Saying something is safe and it being safe are different. So before going public, I knocked on the system
through a student's eyes myself. In doing so I found a gap where a student could read answers through a
back path, and I changed the structure so the place holding the answer is hidden both on screen and in the
data. When I made the repository public, I first erased every real login credential and secret.

### When I hit a limit, I rebuilt the structure

At first, one API key did the grading for everyone. It was soon clear that would become a bottleneck. So I
changed it so each teacher plugs in their own key — and can choose among several providers at that. Then,
uneasy that the key would sit in the database as plain text, I made it so it can only be unlocked by a secret
held on the server, stored encrypted. Whenever a need appeared, instead of bolting on a feature, I chose to
rebuild the structure one layer down.

---

## Three · What I learned

- **A tool is designed in the classroom, not in the code.** Whether it was right for the lesson came before
  whether it was technically possible. One good question came ahead of ten good lines of code.
- **Shipping small and using it is the most accurate design meeting.** I worked in the order of learning after
  release, not verifying after completion.
- **Give AI the tireless diligence; give people the judgment and the relationships.** I gladly handed off the
  repetitive draft work, but the weight of what stays on a student's record was the teacher's to carry.
- **Go public only after you've made it safe.** Ahead of the convenience of leaving things open, I first
  locked down what had to be protected.

> Even without knowing how to code, someone who knows what they are building and why can see a tool through
> to the end.

---

## Closing — Where this tool is headed

In the end, what I wanted is not grand. That a teacher steps a little out of the drudgery of grading, and
spends that much more on the students. That while AI writes the drafts in their place, the person stays with
the work of judging, encouraging, and teaching. And that this way of working does not stay in one classroom,
but is copied onto each person's own server and carried into other classrooms too.

The tool will keep being fixed. But the principles laid over it — protect the student, let the person judge,
ship and learn quickly — I mean to keep from wavering. That is why I leave this record.
