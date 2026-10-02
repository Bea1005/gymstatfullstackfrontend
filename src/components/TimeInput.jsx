import React, { useRef, useState } from 'react';
import './TimeInput.css';

const TimeInput = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  options,
  disabledOptions = [],
  className = '',
  inputClassName = '',
  placeholder = '',
  required = false,
  invalid = false,
  describedBy,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);
  const optionsId = `${id}-options`;

  const handleBlur = (event) => {
    onBlur?.(event);
    if (!pickerRef.current?.contains(event.relatedTarget)) setIsOpen(false);
  };

  const focusFirstOption = () => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      pickerRef.current?.querySelector('[role="option"]:not(:disabled)')?.focus();
    });
  };

  return (
    <div className={`time-picker ${className}`.trim()} ref={pickerRef}>
      <input
        id={id}
        className={`time-picker__input ${inputClassName}`.trim()}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusFirstOption();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={optionsId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        required={required}
      />
      {isOpen && (
        <div className="time-picker__options" id={optionsId} role="listbox" aria-label={`${label} options`}>
          {options.map((option) => {
            const isDisabled = disabledOptions.includes(option);
            return (
              <button
                className="time-picker__option"
                key={option}
                type="button"
                role="option"
                aria-selected={value === option}
                disabled={isDisabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimeInput;