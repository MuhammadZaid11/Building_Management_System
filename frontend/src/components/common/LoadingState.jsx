export default function LoadingState({ message = 'Loading...' }) {
  return (
    <p className="state" role="status">
      {message}
    </p>
  )
}
