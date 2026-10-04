export default function SessionGate({ message = 'Checking your session...' }) {
  return (
    <div className="session-gate" role="status">
      <p>{message}</p>
    </div>
  )
}
