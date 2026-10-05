import { AlertTriangle } from 'lucide-react'

export function Loading({ label = 'Loading...' }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function Alert({ children, onRetry, style }) {
  return (
    <div className="alert" role="alert" style={style}>
      <AlertTriangle size={16} />
      <span>{children}</span>
      {onRetry && <button className="btn btn-sm btn-secondary" onClick={onRetry}>Retry</button>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={36} strokeWidth={1.75} />}
      <div className="empty-state-title">{title}</div>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
