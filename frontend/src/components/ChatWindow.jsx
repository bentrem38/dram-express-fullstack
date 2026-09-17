import { useState } from 'react'

const API_BASE = 'http://localhost:8000'

export default function ChatWindow({ sessionId }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to DRAM Express Support! Ask a question below.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage.content, session_id: sessionId }),
    })

    const data = await response.json()
    setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
    setLoading(false)
  }

  return (
    <div className="chat-window">
      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="chat-bubble assistant">Thinking...</div>}
      </div>
      <form onSubmit={sendMessage} className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
