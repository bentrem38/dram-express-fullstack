import { useState } from 'react'

const API_BASE = 'http://localhost:8000'

export default function LoginForm({ onLogin }) {
  const [customerId, setCustomerId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: parseInt(customerId, 10),
        password,
      }),
    })

    if (!response.ok) {
      setError('Login failed.')
      return
    }

    const data = await response.json()
    onLogin(data.session_id, data.first_name)
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h3>Log In</h3>
      <input
        type="number"
        placeholder="Customer ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Log In</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
