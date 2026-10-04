export default function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="button button-quiet" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}
