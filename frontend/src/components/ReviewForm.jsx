import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:8000'

export default function ReviewForm({ sessionId }) {
  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/orders?session_id=${sessionId}`)
      .then((res) => res.json())
      .then(setOrders)
  }, [sessionId])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    const response = await fetch(`${API_BASE}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        order_id: parseInt(orderId, 10),
        rating: parseInt(rating, 10),
        comment,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      setMessage({ type: 'error', text: data.detail })
      return
    }

    setMessage({ type: 'success', text: 'Thank you for your perfect review!' })
    setComment('')
  }

  if (orders.length === 0) {
    return <p>You have no orders to review.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="review-form">
      <h3>Leave a Review</h3>
      <select value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
        <option value="">Select an order</option>
        {orders.map((o) => (
          <option key={o.order_id} value={o.order_id}>
            Order {o.order_id} ({o.status})
          </option>
        ))}
      </select>
      <input
        type="number"
        min="1"
        max="5"
        value={rating}
        onChange={(e) => setRating(e.target.value)}
      />
      <textarea
        placeholder="Your comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button type="submit">Submit Review</button>
      {message && <p className={message.type}>{message.text}</p>}
    </form>
  )
}
