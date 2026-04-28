export function StatusDot({ status = 'active', children }) {
  return (
    <span className={`status-dot ${status}`}>
      {children}
    </span>
  );
}
