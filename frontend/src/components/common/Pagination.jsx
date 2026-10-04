export default function Pagination({ page, total, totalPages, onPage }) {
  const pages = Math.max(totalPages || 0, 1)

  return (
    <nav className="pager" aria-label="Pagination">
      <p>
        {total} {total === 1 ? 'record' : 'records'}
      </p>
      <p>
        Page {page} of {pages}
      </p>
      <div className="pager-actions">
        <button type="button" className="button button-quiet" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => onPage(page + 1)}
          disabled={!totalPages || page >= totalPages}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
