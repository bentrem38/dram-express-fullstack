# DRAM Express Assistant — Full-Stack Version

A rebuild of the [DRAM Express Assistant](../rag-sql-proj) as a real
full-stack application: a **FastAPI REST API backend** and a separate
**React frontend**, talking to each other over HTTP, instead of one
Streamlit process doing everything.

The underlying RAG + text-to-SQL logic is unchanged — this project is
specifically about the architecture around it.

![Screenshot showing the chat interface answering a policy question](assets/demo.png)

---

## Why Rebuild It This Way

The Streamlit version is one Python process: UI rendering and backend
logic live together, with no real separation between them. A
traditional full-stack app splits those into two genuinely independent
programs — a backend that only knows about data and logic, and a
frontend that only knows about rendering and user interaction,
connected by a defined API contract.

That separation is the actual skill this version demonstrates.

## Architecture

| Layer | Tech | Responsibility |
|---|---|---|
| Frontend | React + Vite | Renders the UI, manages client-side state, calls the API |
| Backend | FastAPI + Uvicorn | REST API: classification, RAG retrieval, SQL generation, answer synthesis |
| Session handling | In-memory dict, keyed by UUID | Tracks which customer a `session_id` belongs to |
| Database | SQLite (same schema as the original project) | Customer, product, order, review data |
| Vector store | ChromaDB | RAG document retrieval |
| Model | Meta-Llama-3.1-8B-Instruct (Q4_K_M), local via `llama-cpp-python` | Classification, SQL generation, answer synthesis |

**Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/login` | Authenticate, returns a `session_id` |
| POST | `/api/logout` | Ends a session |
| POST | `/api/chat` | Ask a question, get a routed/synthesized answer |
| GET | `/api/orders` | List the logged-in customer's orders (for the review form) |
| POST | `/api/review` | Submit a review |

Visit `/docs` on the running backend for live, interactive API
documentation (FastAPI generates this automatically).

## How to Run It

Two servers, two terminals, both need to be running at once.

**Terminal 1 — backend:**
```bash
pip install fastapi uvicorn
python seed_db.py
python build_index.py
python -m uvicorn api:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The model
is the same one used in the original project — see that project's
README for the download command.

## What I Learned / What I'm Taking Away

**The client-server boundary is a real thing you have to think
about, not just an abstraction.** The frontend runs entirely in the
browser — it has no automatic access to anything on the backend
machine. Every single fact the UI displays has to travel over an
explicit HTTP request. This became concrete (and initially confusing)
when the chat window hung on "Thinking..." forever: the frontend's
`fetch()` call was trying to reach the backend's port, and that port
simply wasn't reachable yet. Two separate processes means two separate
things that both have to actually be running and actually be reachable.

**REST design is a real design decision, not just "add some
endpoints."** The terminal and Streamlit versions used a conversational,
multi-step state machine for login and reviews (ask for ID, then
password, then order, then rating, then comment, one message at a
time). Over a REST API, that pattern is awkward — HTTP requests are
naturally one-shot, not conversational. Redesigning those flows as
proper forms hitting single endpoints (`POST /api/login` with the full
payload at once, not one field at a time) was a genuine architecture
decision, not just a restyling.

**Silent failures are worse than loud ones.** The first version of the
frontend's `fetch()` calls had no error handling — when the backend was
unreachable, the request just failed and nothing happened, no error
shown. Adding `try/catch` around every fetch call and surfacing a real
message ("Could not reach the server") turned an invisible bug into an
obvious, fixable one. This is a general lesson beyond this project:
unhandled failure paths don't disappear, they just become confusing
symptoms reported by whoever hits them first.

**FastAPI's automatic documentation is a genuinely useful development
tool, not just a nice-to-have.** Being able to test each endpoint in
isolation at `/docs`, independent of whether the frontend code was
correct yet, made it possible to confirm the backend worked before
ever touching React — the same "test each layer in isolation" habit
that mattered for RAG retrieval in the original project, applied here
to API endpoints instead of vector search.

**Session management has real design tradeoffs, even at small scale.**
This project uses a simple in-memory dictionary keyed by a UUID, which
is honest and appropriate for a local demo but doesn't survive a
server restart and wouldn't work across multiple server instances. A
production system would use something like Redis or signed JWTs
instead — worth knowing the simple version's limits even when it's
the right choice for the project's actual scale.
