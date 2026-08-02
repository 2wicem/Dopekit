/* eslint-disable react/prop-types */
import { useState } from 'react'

const PasswordInput = ({
  id,
  name,
  value,
  onChange,
  autoComplete = 'current-password',
  required = false,
  minLength,
  className = 'form-control signup-input',
  placeholder,
}) => {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-input-wrap">
      <input
        type={visible ? 'text' : 'password'}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={className}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
      </button>
    </div>
  )
}

export default PasswordInput
