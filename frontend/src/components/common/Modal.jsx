import { useEffect, useId, useRef } from 'react'

export default function Modal({ title, children, onClose }) {
  const titleId = useId()
  const dialogRef = useRef(null)

  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) {
        previous.focus()
      }
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="button button-quiet" onClick={onClose}>
            Close
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
