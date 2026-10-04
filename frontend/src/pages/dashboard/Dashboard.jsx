import { useEffect, useState } from 'react'
import { getHealth } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { useAuth } from '../../hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()
  const [health, setHealth] = useState(null)
  const [statusError, setStatusError] = useState('')

  useEffect(() => {
    let ignore = false

    getHealth()
      .then((data) => {
        if (!ignore) {
          setHealth(data)
          setStatusError('')
        }
      })
      .catch((error) => {
        if (!ignore) {
          setHealth(null)
          setStatusError(getErrorMessage(error))
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <section className="dashboard">
      <h1>Building Management System</h1>
      <p className="welcome">Welcome, {user.name}</p>
      <dl className="facts">
        <div>
          <dt>Role</dt>
          <dd>{user.role}</dd>
        </div>
      </dl>
      <section className="panel" aria-live="polite">
        <h2>System status</h2>
        {health ? (
          <dl className="facts">
            <div>
              <dt>API</dt>
              <dd>{health.status}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{health.database}</dd>
            </div>
          </dl>
        ) : null}
        {statusError ? <p className="form-error">{statusError}</p> : null}
        {!health && !statusError ? <p>Checking system status...</p> : null}
      </section>
    </section>
  )
}
