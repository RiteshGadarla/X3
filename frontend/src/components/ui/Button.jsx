export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) {
  const sizeClass = size !== 'md' ? `btn-${size}` : '';
  return (
    <button 
      className={`btn btn-${variant} ${sizeClass} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
