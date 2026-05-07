export function Input({
  label,
  placeholder,
  type = 'text',
  error,
  value,
  onChange,
  name,
  id,
  required = false,
  disabled = false,
  className = '',
}) {
  const inputId = id || name || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-600 uppercase tracking-wide">
          {label}{required && <span className="text-status-lost ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-sm rounded-md border
          bg-white text-slate-900 placeholder-slate-400
          transition-colors duration-150 outline-none
          ${error
            ? 'border-status-lost focus:ring-2 focus:ring-red-200'
            : 'border-surface-border focus:border-brand-primary focus:ring-2 focus:ring-brand-light'
          }
          disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
        `}
      />
      {error && <p className="text-xs text-status-lost">{error}</p>}
    </div>
  )
}
