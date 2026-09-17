import { useState } from 'react'
import LoginForm from './components/LoginForm.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ReviewForm from './components/ReviewForm.jsx'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [firstName, setFirstName] = useState(null)

  function handleLogin(newSessionId, name) {
    setSessionId(newSessionId)
    setFirstName(name)
  }

  function handleLogout() {
    setSessionId(null)
    setFirstName(null)
  }

  return (
    <div className="app">
      <header>
        <h1>DRAM Express Support</h1>
        {firstName ? (
          <div>
            <span>Logged in as {firstName}</span>
            <button onClick={handleLogout}>Log Out</button>
          </div>
        ) : (
          <span>Not logged in</span>
        )}
      </header>

      <div className="layout">
        <div className="sidebar">
          {sessionId ? <ReviewForm sessionId={sessionId} /> : <LoginForm onLogin={handleLogin} />}
        </div>
        <div className="main">
          <ChatWindow sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}
