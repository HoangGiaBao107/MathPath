import type { InputHTMLAttributes } from "react";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  helperText?: string;
  errorMessage?: string;
};

export function Input({
  id,
  label,
  helperText,
  errorMessage,
  className = "",
  ...props
}: InputProps) {
  const messageId = `${id}-message`;
  const message = errorMessage ?? helperText;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        className={`input ${className}`.trim()}
        id={id}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...props}
      />
      {message ? (
        <span
          className={`field-message${errorMessage ? " field-message--error" : ""}`}
          id={messageId}
          role={errorMessage ? "alert" : undefined}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
