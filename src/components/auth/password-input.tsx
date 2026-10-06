"use client";

import { useState, type InputHTMLAttributes } from "react";

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const { className, ...inputProps } = props;
  return (
    <span className={`password-input-wrap${className ? ` ${className}` : ""}`}>
      <input {...inputProps} type={visible ? "text" : "password"} />
      <button
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        className="password-visibility-toggle"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        {visible ? "Ẩn" : "Hiện"}
      </button>
    </span>
  );
}
