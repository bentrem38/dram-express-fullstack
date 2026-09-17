"""
FastAPI backend for the DRAM Express assistant.

Wraps the existing classification/RAG/SQL/synthesis logic from
router.py and auth.py behind a REST API, so a separate frontend
(React or otherwise) can talk to it over HTTP instead of everything
living in one Streamlit process.

Run:
    uvicorn api:app --reload --port 8000

Then visit http://localhost:8000/docs for interactive API docs
(FastAPI generates this automatically from the code below).
"""

import os
os.environ["LD_LIBRARY_PATH"] = "/home/bptremblay/miniconda3/envs/py311/lib:" + os.environ.get("LD_LIBRARY_PATH", "")

import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import chromadb
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama

from auth import login as auth_login, get_scoped_connection
from router import (
    classify_question,
    get_sql_context,
    get_rag_context,
    synthesize_answer,
    MODEL_PATH,
    CHROMA_PATH,
    COLLECTION_NAME,
    EMBEDDING_MODEL,
)

app = FastAPI(title="DRAM Express Assistant API")

# Allow the React dev server (Vite's default port) to call this API.
# In a real deployment you'd restrict this to your actual frontend's domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- load once at startup, shared across all requests ---
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=4096,
    n_threads=8,
    n_gpu_layers=-1,
    verbose=False,
)
embed_model = SentenceTransformer(EMBEDDING_MODEL)
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
chroma_collection = chroma_client.get_collection(COLLECTION_NAME)

# --- in-memory session store: session_id -> {sql_conn, customer_id, first_name} ---
# NOTE: this is a demo-appropriate approach. It resets if the server restarts,
# and doesn't scale past one server process. A real app would use a proper
# session store (Redis, a database-backed session table, or JWTs) instead.
sessions = {}


# --- request/response schemas ---

class LoginRequest(BaseModel):
    customer_id: int
    password: str


class LoginResponse(BaseModel):
    session_id: str
    first_name: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    label: str
    answer: str


class ReviewRequest(BaseModel):
    session_id: str
    order_id: int
    rating: int
    comment: str


# --- endpoints ---

@app.post("/api/login", response_model=LoginResponse)
def login_endpoint(body: LoginRequest):
    result = auth_login(body.customer_id, body.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Login failed.")

    customer_id, first_name = result
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "sql_conn": get_scoped_connection(customer_id),
        "customer_id": customer_id,
        "first_name": first_name,
    }
    return LoginResponse(session_id=session_id, first_name=first_name)


@app.post("/api/logout")
def logout_endpoint(session_id: str):
    session = sessions.pop(session_id, None)
    if session:
        session["sql_conn"].close()
    return {"ok": True}


@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(body: ChatRequest):
    session = sessions.get(body.session_id) if body.session_id else None

    label = classify_question(llm, body.message)

    # login/leave_review/logout aren't answerable through chat context alone
    # in a stateless API -- tell the frontend so it can show the right form.
    if label in ("login", "leave_review", "logout"):
        return ChatResponse(
            label=label,
            answer="Please use the login or review form for that.",
        )

    context_parts = []
    if label in ("sql", "both"):
        if session is None:
            context_parts.append("The customer is not logged in, so no account data is available.")
        else:
            context_parts.append(get_sql_context(llm, session["sql_conn"], body.message))
    if label in ("rag", "both"):
        context_parts.append(get_rag_context(embed_model, chroma_collection, body.message))

    full_context = "\n\n".join(context_parts)
    answer = synthesize_answer(llm, body.message, full_context)
    return ChatResponse(label=label, answer=answer)


@app.get("/api/orders")
def orders_endpoint(session_id: str):
    session = sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=401, detail="Not logged in.")

    rows = session["sql_conn"].execute(
        "SELECT order_id, status FROM my_orders"
    ).fetchall()
    return [{"order_id": order_id, "status": status} for order_id, status in rows]


@app.post("/api/review")
def review_endpoint(body: ReviewRequest):
    session = sessions.get(body.session_id)
    if session is None:
        raise HTTPException(status_code=401, detail="Not logged in.")

    if body.rating != 5:
        raise HTTPException(
            status_code=400,
            detail=(
                "Ratings below 5 stars are not accepted by this form. "
                "Per our Warranty policy, anything under 5/5 qualifies for "
                "a refund instead. This form only accepts 5 star reviews."
            ),
        )

    session["sql_conn"].execute(
        "INSERT INTO reviews (customer_id, order_id, rating, review_text) VALUES (?, ?, ?, ?)",
        (session["customer_id"], body.order_id, 5, body.comment),
    )
    session["sql_conn"].commit()
    return {"ok": True}