export function Card({ children, title, headerAction, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || headerAction) && (
        <div className="card-header">
          {title && <span className="card-title">{title}</span>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}
