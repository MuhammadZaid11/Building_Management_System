import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../../utils/errors'
import { clearSessionNotice, peekSessionExpired } from '../../utils/session'
import { useAuth } from '../../hooks/useAuth'

function validate(email, password) {
  const errors = {}

  if (!email.trim()) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Password is required.'
  }

  return errors
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(() =>
    peekSessionExpired() ? 'Your session has expired. Please log in again.' : '',
  )
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (status === 'success') {
      navigate('/dashboard', { replace: true })
    }
  }, [status, navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    const errors = validate(email, password)
    setFieldErrors(errors)
    setFormError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    setStatus('loading')

    try {
      clearSessionNotice()
      await login(email.trim(), password)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setFormError(getErrorMessage(error))
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Building Management System</p>
        <h1>Sign in</h1>
        <p className="lede">Use your BMS account to open the dashboard.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setFieldErrors((current) => ({ ...current, email: undefined }))
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email ? (
              <p id="email-error" className="field-error">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-row">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setFieldErrors((current) => ({ ...current, password: undefined }))
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="button button-quiet"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password ? (
              <p id="password-error" className="field-error">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          {status === 'success' ? <p role="status">Signed in. Opening your dashboard.</p> : null}
          <button type="submit" className="button button-primary" disabled={status === 'loading' || status === 'success'}>
            {status === 'loading' ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  )
}
